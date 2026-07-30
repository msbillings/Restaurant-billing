let str = "८० + २१";
// Convert Devanagari digits to ASCII
str = str.replace(/[०-९]/g, d => d.charCodeAt(0) - 0x0966);
console.log("Devanagari:", str);

// Convert Telugu digits
let telugu = "౮౦ + ౨౧";
telugu = telugu.replace(/[౦-౯]/g, d => d.charCodeAt(0) - 0x0C66);
console.log("Telugu:", telugu);

// Convert Fullwidth digits
let fw = "８０ ＋ ２１";
fw = fw.replace(/[０-９]/g, d => d.charCodeAt(0) - 0xFF10);
console.log("Fullwidth:", fw);
