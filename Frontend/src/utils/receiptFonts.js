// Shared Font Styles and Metrics for Thermal Receipts (58mm & 80mm)

export const RECEIPT_FONT_STYLES = [
  { id: 'arial', label: 'Arial (Clean & Modern) - Default', value: 'Arial, Helvetica, sans-serif' },
  { id: 'times', label: 'Times New Roman (Classic High-Contrast) - Default Serif', value: "'Times New Roman', Times, serif" },
  { id: 'roboto', label: 'Roboto (Clear Modern Sans)', value: "'Roboto', sans-serif" },
  { id: 'inter', label: 'Inter (Crisp Digital & Thermal)', value: "'Inter', sans-serif" },
  { id: 'verdana', label: 'Verdana (Wide Spacing - Very Easy to Read)', value: "'Verdana', Geneva, sans-serif" },
  { id: 'trebuchet', label: 'Trebuchet MS (Distinct Open Letters)', value: "'Trebuchet MS', sans-serif" },
  { id: 'tahoma', label: 'Tahoma (Compact & Sharp)', value: "'Tahoma', sans-serif" },
  { id: 'georgia', label: 'Georgia (Warm Readable Serif)', value: "'Georgia', serif" },
  { id: 'courier', label: 'Courier New (Classic Receipt Typewriter)', value: "'Courier New', Courier, monospace" },
  { id: 'lucida', label: 'Lucida Console (Fixed-Pitch Dot Clarity)', value: "'Lucida Console', Monaco, monospace" },
  { id: 'segoe', label: 'Segoe UI (System Standard)', value: "'Segoe UI', Tahoma, sans-serif" },
  { id: 'century', label: 'Century Gothic (Geometric & Open)', value: "'Century Gothic', sans-serif" },
  { id: 'impact', label: 'Impact (Heavy Bold Readability)', value: "'Impact', Charcoal, sans-serif" },
  { id: 'franklin', label: 'Franklin Gothic (Strong Bold Heading)', value: "'Franklin Gothic Medium', Arial, sans-serif" },
  { id: 'mono', label: 'Clean Monospace (Thermal Standard)', value: 'monospace' }
];

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
