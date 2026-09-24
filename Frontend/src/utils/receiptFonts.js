// Shared Font Styles and Metrics for Thermal Receipts (58mm & 80mm)

export const RECEIPT_FONT_STYLES = [
  {
    id: 'arial',
    label: 'Arial (Clean & Modern) - Default',
    shortName: 'Arial',
    category: 'Sans-Serif',
    value: "Arial, 'Arimo', Helvetica, sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'times',
    label: 'Times New Roman (Classic High-Contrast) - Default Serif',
    shortName: 'Times New Roman',
    category: 'Serif',
    value: "'Times New Roman', 'Tinos', Times, 'Lora', serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Times New Roman', 'Tinos', Times, 'Lora', serif" }
  },
  {
    id: 'roboto',
    label: 'Roboto (Clear Modern Sans)',
    shortName: 'Roboto',
    category: 'Sans-Serif',
    value: "'Roboto', sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'inter',
    label: 'Inter (Crisp Digital & Thermal)',
    shortName: 'Inter',
    category: 'Sans-Serif',
    value: "'Inter', sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'verdana',
    label: 'Verdana (Wide Spacing - Very Easy to Read)',
    shortName: 'Verdana',
    category: 'Sans-Serif',
    value: "'Verdana', Geneva, sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { letterSpacing: '0.02em' }
  },
  {
    id: 'trebuchet',
    label: 'Trebuchet MS (Distinct Open Letters)',
    shortName: 'Trebuchet MS',
    category: 'Sans-Serif',
    value: "'Trebuchet MS', 'Segoe UI', sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'tahoma',
    label: 'Tahoma (Compact & Sharp)',
    shortName: 'Tahoma',
    category: 'Sans-Serif',
    value: "'Tahoma', Geneva, sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'georgia',
    label: 'Georgia (Warm Readable Serif)',
    shortName: 'Georgia',
    category: 'Serif',
    value: "'Georgia', 'Lora', serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Georgia', 'Lora', serif" }
  },
  {
    id: 'courier',
    label: 'Courier New (Classic Receipt Typewriter)',
    shortName: 'Courier New',
    category: 'Monospace',
    value: "'Courier New', 'Courier Prime', Courier, monospace",
    escposFont: 'FONT_B',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Courier New', 'Courier Prime', Courier, monospace" }
  },
  {
    id: 'lucida',
    label: 'Lucida Console (Fixed-Pitch Dot Clarity)',
    shortName: 'Lucida Console',
    category: 'Monospace',
    value: "'Lucida Console', 'Roboto Mono', Monaco, monospace",
    escposFont: 'FONT_B',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Lucida Console', 'Roboto Mono', Monaco, monospace" }
  },
  {
    id: 'segoe',
    label: 'Segoe UI (System Standard)',
    shortName: 'Segoe UI',
    category: 'Sans-Serif',
    value: "'Segoe UI', 'Inter', Tahoma, sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'century',
    label: 'Century Gothic (Geometric & Open)',
    shortName: 'Century Gothic',
    category: 'Sans-Serif',
    value: "'Century Gothic', 'Outfit', sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470'
  },
  {
    id: 'franklin',
    label: 'Franklin Gothic (Strong Bold Heading)',
    shortName: 'Franklin Gothic',
    category: 'Sans-Serif',
    value: "'Franklin Gothic Medium', 'Arial Black', Arial, sans-serif",
    escposFont: 'FONT_A',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontWeight: '600' }
  },
  {
    id: 'mono',
    label: 'Clean Monospace (Thermal Standard)',
    shortName: 'Clean Monospace',
    category: 'Monospace',
    value: "'Space Mono', 'Roboto Mono', monospace",
    escposFont: 'FONT_B',
    sample: '1 x Chicken Biryani ₹250.00 • Total ₹470',
    previewStyle: { fontFamily: "'Space Mono', 'Roboto Mono', monospace" }
  }
];

export const findReceiptFont = (fontValOrId) => {
  if (!fontValOrId) return RECEIPT_FONT_STYLES[0];
  const cleaned = String(fontValOrId).trim().toLowerCase();

  // 1. Direct ID match (highest priority, 100% exact)
  const byId = RECEIPT_FONT_STYLES.find(f => f.id.toLowerCase() === cleaned);
  if (byId) return byId;

  // 2. Direct Value match (exact case-insensitive value match)
  const byValue = RECEIPT_FONT_STYLES.find(f => f.value.toLowerCase() === cleaned);
  if (byValue) return byValue;

  // 3. Direct ShortName or Label match
  const byName = RECEIPT_FONT_STYLES.find(f => 
    f.shortName.toLowerCase() === cleaned || 
    f.label.toLowerCase() === cleaned
  );
  if (byName) return byName;

  // 4. Primary font family name match from CSS font stack
  // e.g. "'Space Mono', 'Roboto Mono', monospace" -> primary is "space mono"
  const primaryFont = cleaned.split(',')[0].replace(/['"]/g, '').trim();
  const byPrimary = RECEIPT_FONT_STYLES.find(f => {
    const fPrimary = f.value.toLowerCase().split(',')[0].replace(/['"]/g, '').trim();
    return fPrimary === primaryFont || f.shortName.toLowerCase() === primaryFont || f.id.toLowerCase() === primaryFont;
  });
  if (byPrimary) return byPrimary;

  // 5. Explicit aliases for common legacy font names (specific first, generic last)
  if (cleaned.includes('space mono')) return RECEIPT_FONT_STYLES.find(f => f.id === 'mono') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('lucida console')) return RECEIPT_FONT_STYLES.find(f => f.id === 'lucida') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('courier')) return RECEIPT_FONT_STYLES.find(f => f.id === 'courier') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('times')) return RECEIPT_FONT_STYLES.find(f => f.id === 'times') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('georgia')) return RECEIPT_FONT_STYLES.find(f => f.id === 'georgia') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('century')) return RECEIPT_FONT_STYLES.find(f => f.id === 'century') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('impact')) return RECEIPT_FONT_STYLES.find(f => f.id === 'impact') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('franklin')) return RECEIPT_FONT_STYLES.find(f => f.id === 'franklin') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('trebuchet')) return RECEIPT_FONT_STYLES.find(f => f.id === 'trebuchet') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('tahoma')) return RECEIPT_FONT_STYLES.find(f => f.id === 'tahoma') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('verdana')) return RECEIPT_FONT_STYLES.find(f => f.id === 'verdana') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('segoe')) return RECEIPT_FONT_STYLES.find(f => f.id === 'segoe') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('inter')) return RECEIPT_FONT_STYLES.find(f => f.id === 'inter') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('roboto')) return RECEIPT_FONT_STYLES.find(f => f.id === 'roboto') || RECEIPT_FONT_STYLES[0];
  if (cleaned.includes('arial')) return RECEIPT_FONT_STYLES.find(f => f.id === 'arial') || RECEIPT_FONT_STYLES[0];

  return RECEIPT_FONT_STYLES[0];
};

export const RECEIPT_FONT_SIZES = [
  { id: 'small', label: 'Small', normalPt: '8 pt', headingPt: '11 pt', normalPx: '11.5px', headingPx: '15.5px' },
  { id: 'medium', label: 'Medium', normalPt: '9.5 pt', headingPt: '13 pt', normalPx: '13.5px', headingPx: '18.5px', isDefault: true },
  { id: 'large', label: 'Large', normalPt: '11 pt', headingPt: '15 pt', normalPx: '16px', headingPx: '22px' },
  { id: 'extra-large', label: 'Extra Large', normalPt: '13 pt', headingPt: '18 pt', normalPx: '18.5px', headingPx: '26px' }
];

export const getReceiptFontMetrics = (sizeKey = 'medium', printFormat = '80mm') => {
  const is58 = printFormat === '58mm';
  switch (sizeKey) {
    case 'small':
      return {
        bodySize: is58 ? '11px' : '11.5px',
        itemSize: is58 ? '11.5px' : '12px',
        detailSize: is58 ? '9.5px' : '10.5px',
        subHeadingSize: is58 ? '12px' : '13.5px',
        headingSize: is58 ? '14px' : '15.5px',
        grandTotalSize: is58 ? '15px' : '17px',
        lineHeight: '1.25'
      };
    case 'large':
      return {
        bodySize: is58 ? '15px' : '16px',
        itemSize: is58 ? '15.5px' : '16.5px',
        detailSize: is58 ? '12.5px' : '13.5px',
        subHeadingSize: is58 ? '16.5px' : '18px',
        headingSize: is58 ? '20px' : '22px',
        grandTotalSize: is58 ? '21px' : '23px',
        lineHeight: '1.38'
      };
    case 'extra-large':
      return {
        bodySize: is58 ? '17px' : '18.5px',
        itemSize: is58 ? '17.5px' : '19px',
        detailSize: is58 ? '14px' : '15px',
        subHeadingSize: is58 ? '19px' : '21px',
        headingSize: is58 ? '23px' : '26px',
        grandTotalSize: is58 ? '24px' : '27px',
        lineHeight: '1.42'
      };
    case 'medium':
    default:
      return {
        bodySize: is58 ? '13px' : '13.5px',
        itemSize: is58 ? '13.5px' : '14px',
        detailSize: is58 ? '11px' : '11.5px',
        subHeadingSize: is58 ? '14px' : '15px',
        headingSize: is58 ? '17px' : '18.5px',
        grandTotalSize: is58 ? '18px' : '19.5px',
        lineHeight: '1.32'
      };
  }
};
