




class FuncToExport {

    constructor(file_text) {
        this.code = file_text
    }

    function_to_exports(code_str) {
        code_str = code_str.replace(/^\s*async\s+function\s*/g,'async function ')
        //
        let code_array = code_str.split('async function')
        for ( let i = 0; i < code_array.length; i++ ) {
            let str = code_array[i]
            let lines = str.split('\n')
            for ( let j = 0; j < lines.length; j++ ) {
                let line = lines[j]
                if ( /^\s*function\s+/.test(line) ) {
                    line = line.replace(/^\s*function\s+/g,"export function ")
                    lines[j] = line
                }
            }
            str = lines.join('\n')
            code_array[i] = str
        }

        code_array = code_array.map((str) => str.trim())
        
        let out = code_array.join("\nexport async function ")
        return out
    }

}


module.exports = FuncToExport
