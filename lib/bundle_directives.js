
const worker_thread_import_scheme = "importScripts('@bundle_name')"
const main_page_import_scheme = "<script defer src='@bundle_name'></script>"

/**
 * 
 * @param {string} bundle -- name of the file 
 * @param {object} page_or_worker_context 
 */
function bundle_inclusion_transform(bundle,page_or_worker_context) {
    //
    let btxt = ""
    if ( page_or_worker_context && (page_or_worker_context._page_type === "worker") ) {
        btxt = worker_thread_import_scheme.replace("@bundle_name",bundle)
    } else {
        btxt = main_page_import_scheme.replace("@bundle_name",bundle)
    }
    //
    return btxt
}


module.exports.bundle_inclusion_transform = bundle_inclusion_transform


const css_link = "<link rel='stylesheet' href='@css_file'>"

function link_inclusion_transform(link_spec,page_or_worker_context) {
    let type = 'css'
    link_spec = link_spec.substring(1)
    let link_parts = link_spec.split('>')
    type = link_parts[0]
    let type_file = link_parts[1]
    //
    let ltxt = type_file
    if ( type === 'css' ) {
        ltxt = css_link.replace('@css_file',type_file)
    }
    //
    return ltxt
}


module.exports.link_inclusion_transform = link_inclusion_transform
