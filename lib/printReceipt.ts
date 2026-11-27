/**
 * Formats a bill/receipt number as #000001 on first print,
 * and #000001(1), #000001(2), ... on reprints.
 */
export function formatBillNumber(id: number, printCount = 1): string {
  const base = `#${String(id).padStart(6, '0')}`
  return printCount > 1 ? `${base}(${printCount - 1})` : base
}

/**
 * Prints an 80mm thermal receipt HTML string using @media print + window.print()
 * for reliable cross-browser support without popup blockers or iframe quirks.
 */
export function printReceiptHtml(html: string): void {
  const existingRoot = document.getElementById('print-receipt-root')
  const existingStyle = document.getElementById('print-receipt-style')
  existingRoot?.remove()
  existingStyle?.remove()

  const style = document.createElement('style')
  style.id = 'print-receipt-style'
  style.textContent = `
    @media screen {
      #print-receipt-root { display: none !important; }
    }
    @media print {
      body > *:not(#print-receipt-root) { display: none !important; }
      #print-receipt-root {
        display: block !important;
        font-family: monospace;
        font-size: 12px;
        width: 80mm;
        padding: 8px;
        margin: 0;
      }
      #print-receipt-root * { margin: 0; padding: 0; box-sizing: border-box; }
      #print-receipt-root .center { text-align: center; }
      #print-receipt-root .bold { font-weight: bold; }
      #print-receipt-root .large { font-size: 16px; }
      #print-receipt-root .xlarge { font-size: 20px; }
      #print-receipt-root .small { font-size: 10px; }
      #print-receipt-root .divider { border-top: 1px dashed #000; margin: 6px 0; }
      #print-receipt-root .divider-solid { border-top: 2px solid #000; margin: 6px 0; }
      #print-receipt-root .row { display: flex; justify-content: space-between; margin: 3px 0; }
      #print-receipt-root .row-bold { display: flex; justify-content: space-between; font-weight: bold; margin: 3px 0; }
      #print-receipt-root table { width: 100%; border-collapse: collapse; }
      #print-receipt-root th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 3px; }
      #print-receipt-root th.right { text-align: right; }
      #print-receipt-root td { padding: 4px 0; border-bottom: 1px dashed #ccc; }
      #print-receipt-root td.right { text-align: right; font-weight: bold; font-size: 14px; }
      #print-receipt-root .note-box { border: 1px dashed #000; padding: 4px; margin: 6px 0; text-align: center; font-style: italic; }
      #print-receipt-root .muted { color: #555; }
      @page { margin: 0; size: 80mm; }
    }
  `

  const root = document.createElement('div')
  root.id = 'print-receipt-root'
  root.innerHTML = html

  document.head.appendChild(style)
  document.body.appendChild(root)

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    window.removeEventListener('afterprint', cleanup)
    root.remove()
    style.remove()
  }

  window.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 60000)

  window.print()
}
