"use client";

export default function WordSenseSelectVisibleRows() {
  return (
    <input
      type="checkbox"
      aria-label="Select all visible WordSense rows"
      title="Select all visible WordSense rows"
      onChange={(event) => {
        document.querySelectorAll<HTMLInputElement>("input[data-word-sense-maintenance-row]")
          .forEach((input) => { input.checked = event.currentTarget.checked; });
      }}
    />
  );
}
