'use strict';

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow exporting metadata from client components (components with "use client")',
			category: 'Next.js',
			recommended: true,
			url: 'https://nextjs.org/docs/app/api-reference/directives/use-client'
		},
		messages: {
			noMetadataInClient: 'Cannot export "metadata" from a component marked with "use client". Remove the export or the "use client" directive.'
		},
		schema: []
	},

	create(context) {
		let hasUseClientDirective = false;
		let metadataExportNode = null;

		return {
			Program() {
				hasUseClientDirective = false;
				metadataExportNode = null;
			},

			ExpressionStatement(node) {
				// Check for "use client" directive
				if (
					node.expression.type === 'Literal' &&
					(node.expression.value === 'use client' ||
						node.expression.value === '"use client"' ||
						node.expression.value === "'use client'")
				) {
					hasUseClientDirective = true;
				}
			},

			'Literal:first-child'(node) {
				// Check if the first statement is "use client"
				if (
					node.parent.type === 'ExpressionStatement' &&
					node.parent.parent.type === 'Program' &&
					node.parent.parent.body[0] === node.parent &&
					(node.value === 'use client' ||
						node.value === '"use client"' ||
						node.value === "'use client'")
				) {
					hasUseClientDirective = true;
				}
			},

			ExportNamedDeclaration(node) {
				// Check if we're exporting a const named "metadata"
				if (node.declaration && node.declaration.type === 'VariableDeclaration') {
					for (const declaration of node.declaration.declarations) {
						if (declaration.id.name === 'metadata') {
							metadataExportNode = node;
						}
					}
				}
			},

			'Program:exit'() {
				// After parsing the entire file, check if we have both conditions
				if (hasUseClientDirective && metadataExportNode) {
					context.report({
						node: metadataExportNode,
						messageId: 'noMetadataInClient'
					});
				}
			}
		};
	}
};