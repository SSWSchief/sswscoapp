const dangerous=/^[=+\-@\t\r]/;
export function safeCsvCell(value:unknown){let text=value==null?"":String(value);if(dangerous.test(text))text=`'${text}`;return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
export function toCsv(headers:string[],rows:unknown[][]){return [headers,...rows].map(row=>row.map(safeCsvCell).join(",")).join("\r\n")+"\r\n";}
export function downloadCsv(filename:string,csv:string){const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);}
