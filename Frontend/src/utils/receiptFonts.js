// Shared Font Styles and Metrics for Thermal Receipts (58mm & 80mm)

export const RECEIPT_FONT_STYLES = [
  {
    id: 'arial',
    label: 'Arial (Clean & Modern) - Default',
    shortName: 'Arial',
    category: 'Sans-Serif',
    value: "Arial, 'Arimo', Helvetica, sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'times',
    label: 'Times New Roman (Classic High-Contrast) - Default Serif',
    shortName: 'Times New Roman',
    category: 'Serif',
    value: "'Times New Roman', 'Tinos', Times, 'Lora', serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Times New Roman', 'Tinos', Times, 'Lora', serif" }
  },
  {
    id: 'roboto',
    label: 'Roboto (Clear Modern Sans)',
    shortName: 'Roboto',
    category: 'Sans-Serif',
    value: "'Roboto', sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'inter',
    label: 'Inter (Crisp Digital & Thermal)',
    shortName: 'Inter',
    category: 'Sans-Serif',
    value: "'Inter', sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'verdana',
    label: 'Verdana (Wide Spacing - Very Easy to Read)',
    shortName: 'Verdana',
    category: 'Sans-Serif',
    value: "'Verdana', Geneva, sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { letterSpacing: '0.02em' }
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS (Distinct Open Letters)',
    shortName: 'Trebuchet MS',
    category: 'Sans-Serif',
    value: "'Trebuchet MS', 'Segoe UI', sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'tahoma',
    label: 'Tahoma (Compact & Sharp)',
    shortName: 'Tahoma',
    category: 'Sans-Serif',
    value: "'Tahoma', Geneva, sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'georgia',
    label: 'Georgia (Warm Readable Serif)',
    shortName: 'Georgia',
    category: 'Serif',
    value: "'Georgia', 'Lora', serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Georgia', 'Lora', serif" }
  },
  {
    id: 'courier',
    label: 'Courier New (Classic Receipt Typewriter)',
    shortName: 'Courier New',
    category: 'Monospace',
    value: "'Courier New', 'Courier Prime', Courier, monospace",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Courier New', 'Courier Prime', Courier, monospace" }
  },
  {
    id: 'lucida',
    label: 'Lucida Console (Fixed-Pitch Dot Clarity)',
    shortName: 'Lucida Console',
    category: 'Monospace',
    value: "'Lucida Console', 'Roboto Mono', Monaco, monospace",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Lucida Console', 'Roboto Mono', Monaco, monospace" }
  },
  {
    id: 'segoe',
    label: 'Segoe UI (System Standard)',
    shortName: 'Segoe UI',
    category: 'Sans-Serif',
    value: "'Segoe UI', 'Inter', Tahoma, sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'century',
    label: 'Century Gothic (Geometric & Open)',
    shortName: 'Century Gothic',
    category: 'Sans-Serif',
    value: "'Century Gothic', 'Outfit', sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'impact',
    label: 'Impact (Heavy Bold Readability)',
    shortName: 'Impact',
    category: 'Display',
    value: "'Impact', 'Oswald', Charcoal, sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Impact', 'Oswald', Charcoal, sans-serif", fontWeight: '700', letterSpacing: '0.04em' }
  },
  {
    id: 'franklin',
    label: 'Franklin Gothic (Strong Bold Heading)',
    shortName: 'Franklin Gothic',
    category: 'Sans-Serif',
    value: "'Franklin Gothic Medium', 'Arial Black', Arial, sans-serif",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontWeight: '600' }
  },
  {
    id: 'mono',
    label: 'Clean Monospace (Thermal Standard)',
    shortName: 'Clean Monospace',
    category: 'Monospace',
    value: "'Space Mono', 'Roboto Mono', monospace",
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Space Mono', 'Roboto Mono', monospace" }
  }
];

export const findReceiptFont = (fontValOrId) => {
  if (!fontValOrId) return RECEIPT_FONT_STYLES[0];
  const cleaned = String(fontValOrId).trim().toLowerCase();
  return RECEIPT_FONT_STYLES.find(f => 
    f.id === cleaned || 
    f.value.toLowerCase() === cleaned || 
    f.shortName.toLowerCase() === cleaned ||
    cleaned.includes(f.id) ||
    cleaned.includes(f.shortName.toLowerCase())
  ) || RECEIPT_FONT_STYLES[0];
};

export const RECEIPT_FONT_SIZES = [
  { id: 'small', label: 'Small', normalPt: '8–9 pt', headingPt: '11 pt', normalPx: '12px', headingPx: '16px' },
  { id: 'medium', label: 'Medium', normalPt: '9–10 pt', headingPt: '12–13 pt', normalPx: '13.5px', headingPx: '17.5px', isDefault: true },
  { id: 'large', label: 'Large', normalPt: '10–11 pt', headingPt: '13–14 pt', normalPx: '15px', headingPx: '19.5px' },
  { id: 'extra-large', label: 'Extra Large', normalPt: '11–12 pt', headingPt: '15–16 pt', normalPx: '16.5px', headingPx: '21.5px' }
];

export const getReceiptFontMetrics = (sizeKey = 'medium', printFormat = '80mm') => {
  const is58 = printFormat === '58mm';
  switch (sizeKey) {
    case 'small':
      return {
        bodySize: is58 ? '12px' : '12.5px',
        itemSize: is58 ? '12.5px' : '13.5px',
        detailSize: is58 ? '11px' : '11.5px',
        subHeadingSize: is58 ? '13px' : '14.5px',
        headingSize: is58 ? '15.5px' : '17px',
        grandTotalSize: is58 ? '16.5px' : '18.5px',
        lineHeight: '1.3'
      };
    case 'large':
      return {
        bodySize: is58 ? '14px' : '14.5px',
        itemSize: is58 ? '14.5px' : '15.5px',
        detailSize: is58 ? '12.5px' : '13px',
        subHeadingSize: is58 ? '15.5px' : '16.5px',
        headingSize: is58 ? '18px' : '20px',
        grandTotalSize: is58 ? '19.5px' : '22px',
        lineHeight: '1.36'
      };
    case 'extra-large':
      return {
        bodySize: is58 ? '15px' : '16px',
        itemSize: is58 ? '16px' : '17px',
        detailSize: is58 ? '13.5px' : '14px',
        subHeadingSize: is58 ? '17px' : '18.5px',
        headingSize: is58 ? '20px' : '22px',
        grandTotalSize: is58 ? '21.5px' : '24px',
        lineHeight: '1.4'
      };
    case 'medium':
    default:
      return {
        bodySize: is58 ? '13px' : '13.5px',
        itemSize: is58 ? '13.5px' : '14.5px',
        detailSize: is58 ? '11.5px' : '12px',
        subHeadingSize: is58 ? '14px' : '15.5px',
        headingSize: is58 ? '17px' : '18.5px',
        grandTotalSize: is58 ? '18px' : '20px',
        lineHeight: '1.33'
      };
  }
};
