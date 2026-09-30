const fs = require('fs');
let code = fs.readFileSync('d:/restaurant/Restaurant-billing/SuperAdminFrontend/src/App.jsx', 'utf8');
code = code.replace(
  '                        style={{ width: `${Math.max(count > 0 ? 10 : 0, percent)}%` }}\n                      />\n                    </div>\n                  </div>\n                );\n              })}',
  '                        style={{ width: `${Math.max(count > 0 ? 10 : 0, percent)}%` }}\n                      />\n                    </div>\n                    {/* Collections Capacity */}\n                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-col items-center">\n                      <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Collections</span>\n                      <span className="text-xs font-mono font-bold text-emerald-400">\n                        {clusterCollections[cl.id] || 0} <span className="text-slate-500">/ 500</span>\n                      </span>\n                    </div>\n                  </div>\n                );\n              }}'
);
fs.writeFileSync('d:/restaurant/Restaurant-billing/SuperAdminFrontend/src/App.jsx', code);
console.log('Replaced');
