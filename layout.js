/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* Copyright (C) 2009-2011 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
   large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

   Use and redistribution (especially embedding in other
   CC licensed content) is permitted under the terms of the
   Creative Commons "Attribution-NonCommercial" license:

   http://creativecommons.org/licenses/by-nc/3.0/ 

   Other uses may be allowed based on prior agreement with
   beingmeta, inc.  Inquiries can be addressed to:

   licensing@beingmeta.com

   Enjoy!

*/

var CodexPaginate=
    (function(){
	var debug_pagination=true;
	var sbook_paginated=false;
	var sbook_left_px=40;
	var sbook_right_px=40;
	var sbook_widow_limit=3;
	var sbook_orphan_limit=3;
	var sbook_pagesize=-1;
	var sbook_pagemaxoff=-1;
	var sbook_pagescroll=false;
	var sbook_fudge_bottom=false;
	
	var pagebreakbefore=false;
	var pagebreakafter=false;
	
	var pretweak_page_breaks=true;

	var sbook_edge_taps=true;

	var sbook_avoidpagebreak=false;
	var sbook_forcebreakbefore=false;
	var sbook_forcebreakafter=false;
	var sbook_avoidpagefoot=false;
	var sbook_avoidpagehead=false;
	var sbook_pageblock=false;
	var sbook_fullpages=false;

	var isEmpty=fdjtString.isEmpty;
	var getGeometry=fdjtDOM.getGeometry;
	var hasParent=fdjtDOM.hasParent;
	var getParent=fdjtDOM.getParent;
	var getStyle=fdjtDOM.getStyle;
	var parsePX=fdjtDOM.parsePX;
	var geomString=fdjtDOM.geomString;
	var insertBefore=fdjtDOM.insertBefore;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var nextElt=fdjtDOM.nextElt;
	var forward=fdjtDOM.forward;
	var TOA=fdjtDOM.toArray;
	
	var sbook_body=false;
	var page_width=false;
	var page_height=false;
	var page_gap=false;
	var flip_width=false;
	var offset_left=false;
	
	var runslice=100; var runwait=50;

	var dropClass=fdjtDOM.dropClass;
	var addClass=fdjtDOM.addClass;

	/* Codex trace levels */
	/* 0=notrace (do final summary if tracing startup)
	   1=trace repagination chunk by chunk
	   2=trace inserted page breaks
	   3=trace every node consideration
	*/

	Codex.pageTop=function(){return sbook_top_px;}
	Codex.pageBottom=function(){return sbook_bottom_px;}
	Codex.pageLeft=function(){return sbook_left_px;}
	Codex.pageRight=function(){return sbook_right_px;}
	Codex.pageSize=function(){return Codex.page.offsetHeight;}

	function readSettings(){
	    sbook_avoidpagebreak=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
	    sbook_forcebreakbefore=
		fdjtDOM.sel(fdjtDOM.getMeta("forcebreakbefore",true));
	    sbook_forcebreakafter=
		fdjtDOM.sel(fdjtDOM.getMeta("forcebreakafter",true));
	    sbook_avoidpagefoot=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakafter",true));
	    sbook_avoidpagehead=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakbefore",true));
	    sbook_fullpages=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));}
	Paginate.readSettings=readSettings;

	/* Updating the page display */

	function updatePageDisplay(pagenum,location) {
	    var npages=Codex.pagecount;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=Codex.ends_at;
	    pbar.style.left=(100*(pagenum/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff=fdjtDOM
	    ("span.locoff#CODEXLOCOFF","L"+Math.floor(location/128));
	    var pageno_text=fdjtDOM
	    ("span#CODEXPAGENOTEXT.pageno",pagenum+1,"/",npages);
	    var pageno=fdjtDOM("div#CODEXPAGENO",locoff,pageno_text);
	    fdjtDOM.replace("CODEXPAGENO",pageno);
	    fdjtDOM.replace("CODEXPROGRESSBAR",pbar);
	    locoff.title="click to jump to a particular location";
	    fdjtDOM.addListeners
	    (locoff,Codex.UI.handlers[Codex.ui]["#CODEXLOCOFF"]);
	    pageno_text.title="click to jump to a particular page";
	    fdjtDOM.addListeners
	    (pageno_text,Codex.UI.handlers[Codex.ui]["#CODEXPAGENOTEXT"]);}

	
	/* Pagination */

	var fakeid_count=1;

	function dupContext(node,page,dups){
	    if (hasParent(node,page)) return node;
	    if ((node===document.body)||(hasClass(node,"codexpage"))||
		(node.id==="CODEXCONTENT"))
		return false;
	    var id=node.id;
	    if (!(id)) id=node.id="CODEXFAKEID"+(fakeid_count++);
	    var dup=dups[id];
	    if ((dup)&&(hasParent(dup,page))) return dup;
	    var parent=dupContext(node.parentNode,page,dups);
	    var nodeclass=node.className||"";
	    var copy=node.cloneNode(false);
	    var copyclass=nodeclass;
	    copyclass=copyclass.replace(/\bcodexrelocated\b/,"");
	    copyclass=copyclass.replace(/\bcodexdup.*\b/,"");
	    copyclass=copyclass.replace(/\s+/," ");
	    copyclass=copyclass+" codexdup";
	    copy.className=copyclass;
	    if (nodeclass.search(/\bcodexdupstart\b/)<0)
		node.className=nodeclass+" codexdupstart";
	    
	    if (copy.id) {
		copy.setAttribute("data-baseid",copy.id);
		copy.id=null;}
	    dups[id]=copy;
	    if (parent) parent.appendChild(copy);
	    else page.appendChild(copy);
	    return copy;}

	function getRoot(node){
	    var scan=node;
	    while (scan) {
		if (scan.parentNode) scan=scan.parentNode;
		else return scan;}
	    return node;}

	var codex_reloc_serial=1;
	
	function moveNode(node,into){
	    var classname;
	    if (node.nodeType===1) classname=node.className;
	    else if (node.nodeType===3) {
		node=fdjtDOM("span.codextext",node.nodeValue);
		classname="codextext";}
	    if (((!(classname))||(classname.search(/\bcodexrelocated\b/)<0))&&
		(node.parentNode)) {
		var origin=fdjtDOM("span.codexorigin");
		var id=origin.id="CODEXORIGIN"+(codex_reloc_serial++);
		if (classname) node.className=classname+" codexrelocated";
		else node.className="codexrelocated";
		node.setAttribute("data-codexorigin",id);
		node.parentNode.replaceChild(origin,node);}
	    into.appendChild(node);
	    return node;}
	
	function moveNodeToPage(node,page,dups){
	    if (hasParent(node,page)) return;
	    var parent=node.parentNode;
	    if ((!(parent)) || (parent===document.body) ||
		(parent.id==="CODEXCONTENT") ||
		(hasClass(parent,"codexpage")))
		moveNode(node,page);
	    else {
		var adoptive=dupContext(parent,page,dups);
		moveNode(node,adoptive);}}

	function restoreNode(node){
	    var origin=node.getAttribute("data-codexorigin");
	    if (origin) origin=document.getElementById(origin);
	    if (origin) {
		if (fdjtDOM.hasClass(node,"codextext"))
		    origin.parentNode.replaceChild(node.childNodes[0],origin);
		else origin.parentNode.replaceChild(node,origin);}
	    dropClass(node,"codexrelocated");
	    node.removeAttribute("data-codexorigin");}
	
	function Paginate(root,state){
	    if (!(state)) state={};
	    var page_height=(state.page_height)||
		(state.page_height=(getGeometry("CODEXPAGE").height));
	    var page_width=(state.page_width)||
		(state.page_width=(getGeometry("CODEXPAGE").width));
	    var pages=(state.pages)||
		(state.pages=pages=fdjtDOM("div.codexpages"));
	    var pagenum=(state.pagenum||(state.pagenum=0));
	    var dups=state.dups||(state.dups={});
	    var page=state.page||(newPage());
	    var prev=(state.prev)||false;
	    var prevstyle=state.prevstyle||((prev)&&(getStyle(prev)));
	    var started=state.started||(state.started=fdjtTime());
	    var trace=((state.hasOwnProperty('trace'))?
		       (state.trace||0):(Codex.Trace.layout||0));

	    if (state.chunks) state.chunks=state.chunks+1;
	    else state.chunks=1;

	    if (!(state.pagerule)) {
		var pagerule=fdjtDOM.addCSSRule(
		    "div.codexpage",
		    "width: "+page_width+"px; "+"height: "+page_height+"px;");
		state.pagerule=pagerule;}

	    function loop(node){
		if (node.nodeType===3) {
		    var value=node.nodeValue;
		    // scanText(node);
		    if (value.length>0) moveNodeToPage(node,page,dups);}
		else if (node.nodeType===1) {
		    var style=getStyle(node);
		    if (forceBreakBefore(node,style)) newPage();
		    else if (forceBreakAfter(prev,prevstyle)) newPage();
		    else {}
		    moveNodeToPage(node,page,dups);
		    var geom=getGeometry(node,page);
		    var classname=node.className;
		    if (trace>2) fdjtLog("PG/loop %o g=%j",node,geom);
		    if ((geom.bottom>page_height))
			forceBreak(node,geom,style);
		    else if (trace>2)
			fdjtLog("PG/placed %o on %o",node,page);
		    else {}
		    prev=node; prevstyle=style;}
		else {}}
	    /*
	    function scanText(textnode){
		if (hasParent(textnode,page)) return;
		var parent=dupNode(textnode.parentNode,page);
		var moved=moveNode(textnode,parent);
		var geom=getGeometry(moved,page);
		if (geom.bottom>page_height) {
		    parent.removeChild(moved);
		    var text=textnode.nodeValue;
		    var words=text.slice();
		    var i=0; var n=words.length;
		    while (i<n) {
			var word=words[i++];
			if (word==="") {}
			else if (word.search(/\S/)<0)
			    scan(fdjtDOM("span.codexword",word));
			else .appendChild(document.createTextNode(word));}}
		else moved.replaceChild(textnode,moved);}
	    */
	    function forceBreak(node,geom,style){
		if (style.pageBreakInside==='avoid') {
		    if ((avoidBreakBefore(node,style))||
			((prev)&&(avoidBreakAfter(prev,prevstyle)))) {
			if (trace>1)
			    fdjtLog("PG/keep/forceprev %o g=%j",node,geom);
			newPage(prev); moveNodeToPage(node,page,dups);
			prev=node; prevstyle=style;}
		    else {
			if (trace>1)
			    fdjtLog("PG/keep/forced %o g=%j",node,geom);
			newPage(node);}}
		else if ((style.display==='block')||(style.display==='table')) { 
		    if (trace>2) fdjtLog("PG/descend %o g=%j",node,geom);
		    splitChildren(node);}
		else {
		    if (trace>1) fdjtLog("PG/forced %o g=%j",node,geom);
		    newPage(node);}}
	    function splitChildren(node){
		var children=TOA(node.childNodes);
		if (trace>2)
		    fdjtLog("PG/splitChildren (%d) %o",
			    children.length,node);
		var i=0; var n=children.length;
		while (i<n) loop(children[i++]);}
	    function splitText(node){newPage(node);}
	    function newPage(node){
		if (page) fdjtDOM.dropClass(page,"curpage");
		state.page=page=fdjtDOM("div.codexpage.curpage");
		pagenum++; state.pagenum=pagenum;
		page.id="CODEXPAGE"+(pagenum);
		page.setAttribute("data-pagenum",pagenum);
		fdjtDOM(pages,page);

		if (node) moveNodeToPage(node,page,dups);

		if (trace>1) {
		    if (node)
			fdjtLog("PG/newpage %o at %o",page,node);
		    else fdjtLog("PG/newpage %o",page);}
		    
		state.prev=prev=false;
		state.prevstyle=prevstyle=false;
		return page;}
	    
	    loop(root);
	    
	    return state;}

	/* Pagination support functions */
	
	function forceBreakBefore(elt,style){
	    if ((sbook_tocmajor)&&(elt.id)&&
		((Codex.docinfo[elt.id]).toclevel)&&
		(((Codex.docinfo[elt.id]).toclevel)<=sbook_tocmajor))
		return true;
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakBefore==='always')||
		((sbook_forcebreakbefore)&&
		 (sbook_forcebreakbefore.match(elt)));}

	function forceBreakAfter(elt,style){ 
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakAfter==='always')||
		((sbook_forcebreakafter)&&
		 (sbook_forcebreakafter.match(elt)));}

	// We explicitly check for these classes because some browsers
	//  which should know better (we're looking at you, Firefox) don't
	//  represent (or handle) page-break 'avoid' values.  Sigh.
	var page_block_classes=
	    /(\bfullpage\b)|(\btitlepage\b)|(\bsbookfullpage\b)|(\bsbooktitlepage\b)/;
	function avoidBreakInside(elt,style){
	    if (!(elt)) return false;
	    if (elt.tagName==='IMG') return true;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakInside==='avoid')||
		(elt.className.search(page_block_classes)>=0)||
		((sbook_avoidpagebreak)&&(sbook_avoidpagebreak.match(elt)));}

	function avoidBreakBefore(elt,style){
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return ((style.pageBreakBefore==='avoid')||
		    ((sbook_avoidpagehead)&&(sbook_avoidpagehead.match(elt))));}

	function avoidBreakAfter(elt,style){
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakAfter==='avoid') return true;
	    else if ((style.pageBreakAfter)&&
		     (style.pageBreakAfter!=="auto"))
		return false;
	    else if ((elt.id)&&(Codex.docinfo[elt.id])&&
		     ((Codex.docinfo[elt.id]).toclevel))
		return true;
	    else return false;}

	function progress(info){
	    var started=info.started;
	    var pagenum=info.pagenum;
	    var now=fdjtTime();
	    if (!(pagenum)) return;
	    if (!(Codex._setup)) {
		if (typeof arg === 'number')
		    Codex.startupMessage("Laid out %d pages so far",arg);
		else Codex.startupMessage("Finished page layout");}
	    if (info.done)
		fdjtLog("Done with %d pages after %f seconds",
			pagenum,fdjtTime.secs2short((now-started)/1000));
	    else if (typeof pagenum === 'number') {
		fdjtDOM.replace("CODEXPAGEPROGRESS",
				fdjtDOM("span#CODEXPAGEPROGRESS",pagenum));
		if (Codex.Trace.layout)
		    fdjtLog("So far, laid out %d pages in %f seconds",
			    pagenum,fdjtTime.secs2short((now-started)/1000));}
	    else {}}

	/* Debugging support */

	function _paginationInfo(elt,style,startpage,endpage,nextpage,geom,ngeom,
				 at_top,break_after,force_break){
	    var info=getGeometry(elt,Codex.content);
	    return elt.id+"/t"+(elt.toclevel||0)+
		((at_top)?"/top":"")+
		((break_after)?"/breaknext":"")+
		((force_break)?"/forced":"")+
		((forceBreakBefore(elt,style))?"/fbb":"")+
		((forceBreakAfter(elt,style))?"/fba":"")+
		((avoidBreakInside(elt,style))?"/abi":"")+
		((avoidBreakBefore(elt,style))?"/abb":"")+
		((avoidBreakAfter(elt,style))?"/aba":"")+
		((fdjtDOM.hasText(elt,style))?"/text":"")+
		((endpage!==nextpage)?"/af/ba":"")+
		"/sp="+startpage+"/ep="+endpage+"/np="+nextpage+
		" ["+
		info.width+"x"+info.height+"@"+
		info.top+","+info.left+
		"] g="+(geomString(geom))+
		" ng="+geomString(geom);}

	/* Movement by pages */

	function getCSSLeft(node,wrapper){
	    var scan=node;
	    var indent=parsePX(getStyle(scan).marginLeft)||0;
	    while ((scan=scan.parentNode)&&(scan!==wrapper)) {
		var style=getStyle(scan);
		indent=indent+parsePX(style.paddingLeft,0)+
		    parsePX(style.borderLeft)+
		    parsePX(style.marginLeft);}
	    if (scan===wrapper) {
		var style=getStyle(scan);
		indent=indent+parsePX(style.paddingLeft,0)+
		    parsePX(style.borderLeft,0);}
	    return indent;}

	var curpage=false;

	function getPageElt(spec) {
	    if (!(spec)) return false;
	    else if (spec.nodeType) {
		if (hasClass(spec,"codexpage")) return spec;
		else return getParent(spec,".codexpage");}
	    else if (typeof spec === 'number') {
		var pageid="CODEXPAGE"+spec;
		return document.getElementById(pageid);}
	    else if (typeof spec === "string")
		getPageElt(document.getElementById(spec));
	    else return false;}

	function GoToPage(spec,caller,nosave){
	    var page=getPageElt(spec);
	    if (Codex.Trace.flips) fdjtLog("Flipping to %o for %o",page,spec);
	    if (curpage) fdjtDOM.dropClass(curpage,"curpage");
	    var pagenum=parseInt(page.getAttribute("data-pagenum"));
	    fdjtDOM.addClass(page,"curpage");
	    curpage=page;}
	Codex.GoToPage=GoToPage;
	
	function getPage(elt){
	    var page=getPageElt(elt);
	    return parseInt(page.getAttribute("data-pagenum"));}
	Codex.getPage=getPage;
	
	function getPageAt(loc){
	    var elt=Codex.resolveLocation(loc);
	    return getPage(elt);}
	Codex.getPageAt=getPageAt;
	
	function displaySync(){
	    if ((Codex.pagecount)&&(Codex.curpage))
		Codex.GoToPage(Codex.curpage,"displaySync");}
	Codex.displaySync=displaySync;

	/* External refs */
	Paginate.forceBreakBefore=forceBreakBefore;
	Paginate.avoidBreakInside=avoidBreakInside;
	Paginate.forceBreakAfter=forceBreakAfter;
	Paginate.avoidBreakAfter=avoidBreakAfter;
	Paginate.avoidBreakBefore=avoidBreakBefore;
	Paginate.debug=debug_pagination;
	
	/* Top level functions */
	
	function repaginate(){
	    var moved=TOA(document.getElementsByClassName("codexrelocated"));
	    var i=0; var lim=moved.length;
	    while (i<lim) restoreNode(moved[i++]);
	    var newpages=fdjtDOM("div.codexpages#CODEXPAGES");
	    var newinfo={"pages": newpages};
	    fdjtDOM.replace("CODEXPAGES",newpages);
	    var content=Codex.content;
	    var nodes=TOA(content.childNodes);
	    fdjtTime.slowmap(
		function(node){newinfo=Paginate(node,newinfo);},nodes,
		function(state,i,lim,chunks,elapsed,zerostart){
		    if (state==='suspend') progress(newinfo);
		    else if (state==='done')
			fdjtLog("PG/laid out %d HTML blocks across %d pages after %dms, taking %fms over %d chunks",
				newinfo.pagenum,lim,fdjtTime()-zerostart,
				elapsed,chunks);},
		function(){
		    var dups=newinfo.dups;
		    var i=0; var lim=dups.length;
		    for (dupid in dups) {
			var dup=dups[dupid];
			dup.className=dup.className.replace(
				/\bcodexdup\b/,"codexdupend");}
		    newinfo.done=fdjtTime();
		    progress(newinfo);
		    Codex.paginated=newinfo;
		    Codex.pagecount=newinfo.pagenum;});}
	
	var repaginating=false;
	Codex.repaginate=function(){
	    if (repaginating) return;
	    repaginating=setTimeout(
		function(){
		repaginate();
		repaginating=false;},
				    100);};
	
	Paginate.onresize=function(evt){
	    Codex.repaginate();};

	Codex.addConfig
	("pageview",
	 function(name,val){
	     if (val) {
		 if (!(Codex.docinfo)) {
		     // If there isn't any docinfo (during startup, for
		     // instance), don't bother actually paginating.
		     Codex.paginate=true;}
		 else if (!(Codex.paginate)) {
		     Codex.paginate=true;
		     if (Codex.postconfig)
			 Codex.postconfig.push(repaginate);
		     else Codex.repaginate();}}
	     else {
		 clearPagination();
		 Codex.paginate=false;
		 dropClass(document.body,"codexpageview");
		 addClass(document.body,"codexscrollview");}});

	function updateLayout(name,val){
	    fdjtDOM.swapClass
	    (Codex.page,new RegExp("codex"+name+"\w*"),"codex"+name+val);
	    if (Codex.paginated) {
		if (Codex.postconfig) {
		    Codex.postconfig.push(function(){
			CodexMode(true); Codex.repaginate();});}
		else {
		    CodexMode(true); Codex.repaginate();}}}
	Codex.addConfig("bodysize",updateLayout);
	Codex.addConfig("bodystyle",updateLayout);
	
	// fdjtDOM.trace_adjust=true;

	return Paginate;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
