

let html_start_doc_head = `
<!doctype html>
<html>
<head>
`

let end_body_html = `
</body>
</html>
`

let end_head = `
</head>
`

let start_style = `
<style>
`

let end_style = `
</style>
`

let start_script = `
<script lang="JavaScript" >
`

let end_script = `
</script>
`

let start_body = `
<body>
`

let base_patterns_mod = {
    "html:" : {
        "start_doc_head" : html_start_doc_head,
        'end_head': end_head,
        'start_style': start_style,
        'end_style': end_style,
        'start_script': start_script,
        'end_script': end_script,
        'start_body': start_body,
        'end_body_html': end_body_html
    }
}


module.exports.base_patterns_mod = base_patterns_mod