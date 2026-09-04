# no-native-form-input

Require the shadcn `DatePicker`/`TimePicker`/`ColorPicker`/`PhoneNumberInput` instead of a native `input[type]`, unless the case carries a written reason.

## Rule Details

The `react-hook-form` skill mandates these components for date, time, color and phone fields: *"Prefer the components over `type=\"date\"`, `type=\"time\"`, `type=\"tel\"` and `type=\"color\"` too: the native controls work, but lose the country selector, alpha channel, formatting and cross-browser consistency."*

Native `type="date"`/`type="time"` in particular render and parse differently across Chromium, Firefox and WebKit — the exact reason E2E suites drive the shadcn `DatePicker` by its calendar popover instead of filling a native date input.

Both the JSX-native `<input>` and the project's shadcn `<Input>` wrapper (`@/components/ui/input`) are checked — in practice almost every occurrence is `<Input type="date" />`, since `<Input>` is the sanctioned primitive for ordinary text fields and it is easy to reach for it again here without noticing the `type` value crosses into a case with a dedicated component.

### ❌ Incorrect

```tsx
<Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

<input type="color" value={hex} onChange={(e) => setHex(e.target.value)} />

<Input type="tel" {...field} />
```

### ✅ Correct

```tsx
<DatePicker value={field.value} onChange={(v) => field.onChange(v ?? '')} />

<ColorPicker value={hex} onChange={(rgba) => setHex(toHex(rgba))}>
  <ColorPickerSelection className="h-32" />
  <ColorPickerHue />
</ColorPicker>

<PhoneNumberInput value={field.value} onChange={field.onChange} defaultCountry="US" />

// With the reason recorded — e.g. a legacy admin-only debug field
{/* field-reason: internal debug tool, never shown to end users, cross-browser rendering is not a concern here */}
<Input type="date" value={debugDate} onChange={(e) => setDebugDate(e.target.value)} />
```

The annotation is greppable on purpose — `grep -rn "field-reason:"` returns every exception in the codebase together with its rationale, the same contract `no-raw-img-element` uses for `img-reason:`.

## Options

```jsonc
{
  "creatr/no-native-form-input": ["error", {
    "marker": "field-reason:",           // comment prefix that silences the rule
    "minReasonLength": 20,               // reject stub reasons like "legacy"
    "elementNames": ["input", "Input"]   // which JSX element names to check
  }]
}
```

There is deliberately **no autofix** — the correct replacement needs schema/prop wiring (see the `react-hook-form` skill §2 field reference) that the rule cannot infer.

## When Not To Use It

If the project has not scaffolded `@/components/ui/date-picker`, `@/components/ui/time-picker`, `@/components/blocks/color-picker`, or `@/components/ui/phone-input`, turn the rule off (or scope `elementNames` down) rather than annotating every native input — the rule assumes the sanctioned replacement actually exists in the project.
