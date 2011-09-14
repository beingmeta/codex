function splitParent(node)
{
    if ((!(node)) || (node.tagName==="body")) return false;
    else return splitNode(node.parentNode);
}

function splitNode(node)
{
    if (!(node)) return node;
    var parent=splitParent(node);
    var copy=node.clone(false);
    if (node.nodeType===1) {
	var classname=copy.className;
	if (classname.search(/\bcodexsplitstart\b/))
	    copy.className=classname.replace(/\bcodexsplitstart\b/,"codexsplit");
	else if (!(classname.search(/\bcodexsplit\b/)))
	    copy.className=classname+" codexsplitstart";
	else {}
	if (copy.id) {
	    copy.setAttribute("data-baseid",copy.id);
	    copy.id=null;}}
    if (parent) parent.appendChild(copy);
    return copy;
}

function getRoot(node)
{
    while (scan) {
	if (scan.parentNode) scan=scan.parentNode;
	else return scan;}
    return node;
}

var codex_reloc_serial=1;

function moveNode(node,into)
{
    var classname=node.className;
    if ((!(classname))||(classname.search(/\bcodexrelocated\b)<0)) {
	var origin=fdjtDOM("span.codexorigin"); 
	var id=origin.id="CODEXORIGIN"+(codex_reloc_serial++);
	if (classname) node.className=classname+" codexrelocated";
	else node.className="codexrelocated";
	node.setAttribute("data-codexorigin",id);
	node.parentNode.replaceChild(origin,node);}
    into.appendChild(node);
}

function unmoveNode(node)
{
    var origin=node.getAttribute("data-codexorigin");
    if (origin) origin=document.getElementById(origin);
    if (origin) origin.parentNode.replaceChild(node,origin);
    dropClass(node,"codexrelocated");
    node.removeAttribute("data-codexorigin");
}

function paginate(root,pages,page_height)
{
    var page=fdjtDOM("div.page"); var insert=page;
    var prev=false; var prevstyle=false;
    var getGeometry=fdjtDOM.getGeometry;
    var getStyle=fdjtDOM.getStyle;
    var TOA=fdjtDOM.TOA;
    fdjtDOM(pages,page);
    function scan(node){
	if (node.nodeType===3) scanText(node);
	else if (node.nodeType===1) {
	    moveNode(node,insert);
	    var geom=getGeometry(node,page);
	    var classname=node.className;
	    var style=getStyle(node);
	    if ((geom.bottom>page_height))
		pageBreak(node,geom,style);
	    else if ((style.pageBreakBefore==='always')||
		     ((classname)&&(classname.search(/\bcodexbreakbefore\b/)>=0)))
		newPage(node,geom,style);
	    prev=node; prevstyle=style;}
	else {}}
    function scanText(textnode){
	var text=textnode.value;
	var words=text.slice();
	var i=0; var n=words.length;
	while (i<n) {
	    var word=words[i++];
	    if (word==="") {}
	    else if (word.search(/\S/)<0)
		scan(fdjtDOM("span.codexword",word));
	    else insert.appendChild(document.createTextNode(word));}}
    function pageBreak(node,geom,style){
	if (style.pageBreakInside==='avoid') {
	    if ((prev)&&(prevstyle.pageBreakAfter==='avoid')) {
		newPage(prev); moveNode(node,insert);
		prev=node; prevstyle=style;}
	    else newPage(node);}
	else if ((style.display==='block')||(style.display==='table')) 
	    splitChildren(node);
	else newPage(node);}
    function splitChildren(node){
	var children=TOA(node.childNodes);
	var i=0; var n=children.length;
	while (i<n) scan(children[i++]);}
    function splitText(node){newPage(node);}
    function newPage(node){
	page=fdjtDOM("div.page"); fdjtDOM(pages,page);
	insert=splitParent(node);
	fdjtDOM(page,getRoot(insert));
	moveNode(node,insert);
	prev=false; prevstyle=false;}
}

