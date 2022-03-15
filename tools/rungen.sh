dir=$1
echo $dir
top_level=$2
pushd ./tools
node genpage.js ${top_level}/${dir}/static/${dir}.subst ../templates/index.html ${top_level}/${dir}/index.html
popd
