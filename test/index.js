// const papa = require('../index.js')



// papa.browser_code()


let ParseUtils = require('../lib/utils')


let putils = new ParseUtils()

putils.clear_block_comments("")


let commented = 
`----/* ****

This is a test and it shoul be something you can't see.

*

*/
I like living in my house.
-------------------------
/* ****
This is a test and it shoul be something you can't see.
*
*/1234`

let oput = putils.clear_block_comments(commented)

console.log(oput)
