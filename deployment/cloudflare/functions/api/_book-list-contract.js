/** SQL NULL optional text is absence, not a malformed string for the client. */
export function bookListRow(row){
 const value={...row}
 for(const key of ['category','reviewNote'])if(value[key]===null)delete value[key]
 return value
}
