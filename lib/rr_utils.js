
const { dir } = require('console')
const fs = require('fs')




module.exports.browser_code_access = (pars) => {
    if ( pars === undefined ) {
        try {
            let client_code_path = './client'
            let dirlist = fs.readdirSync(client_code_path)
            console.dir(dirlist)
            let file_content = dirlist.map(file_name => {
                let file_path = client_code_path + '/' + file_name
                let content = fs.readFileSync(file_path).toString()
                return content
            })
            return file_content
        } catch(e) {
            console.log(e)
        }
    }
    console.log("no files " + __dirname  + " "  + __filename )
    return []
}

