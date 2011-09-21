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
	
	var tocmajor=false;

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
	var hasContent=fdjtDOM.hasContent;
	var getGeometry=fdjtDOM.getGeometry;
	var getDisplay=fdjtDOM.getDisplay;
	var hasParent=fdjtDOM.hasParent;
	var getParent=fdjtDOM.getParent;
	var getStyle=fdjtDOM.getStyle;
	var parsePX=fdjtDOM.parsePX;
	var geomString=fdjtDOM.geomString;
	var insertBefore=fdjtDOM.insertBefore;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var nextElt=fdjtDOM.nextElt;
	var forward=fdjtDOM.forward;
	var TOA=fdjtDOM.toArray;
	
	var runslice=100; var runwait=50;

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
	    var tocmajor_elt=fdjtDOM.getMeta("sbook.tocmajor",true);
	    if (tocmajor_elt) tocmajor=parseInt(tocmajor_elt);
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
	    pbar.style.left=(100*((pagenum-1)/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff=fdjtDOM(
		"span.locoff#CODEXLOCOFF","L"+Math.floor(location/128));
	    var pageno_text=fdjtDOM(
		"span#CODEXPAGENOTEXT.pageno",pagenum,"/",npages);
	    var pageno=fdjtDOM("div#CODEXPAGENO",locoff,pageno_text);
	    fdjtDOM.replace("CODEXPAGENO",pageno);
	    fdjtDOM.replace("CODEXPROGRESSBAR",pbar);
	    locoff.title="click to jump to a particular location";
	    fdjtDOM.addListeners(
		locoff,Codex.UI.handlers[Codex.ui]["#CODEXLOCOFF"]);
	    pageno_text.title="click to jump to a particular page";
	    fdjtDOM.addListeners(
		pageno_text,Codex.UI.handlers[Codex.ui]["#CODEXPAGENOTEXT"]);}

	
	/* Pagination */

	var fakeid_count=1;

	function dupContext(node,page,dups){
	    if ((node===document.body)||(hasClass(node,"codexpage"))||
		(node.id==="CODEXCONTENT"))
		return false;
	    else if (hasParent(node,page)) return node;
	    else if ((node.className)&&
		     (node.className.search(/\bcodextext\b/)>=0))
		return dupContext(node.parentNode,page,dups);
	    var id=node.id;
	    if (!(id)) id=node.id="CODEXTMPID"+(fakeid_count++);
	    var dup=dups[id];
	    if ((dup)&&(hasParent(dup,page))) return dup;
	    var parent=dupContext(node.parentNode,page,dups);
	    var nodeclass=node.className||"";
	    var copy=node.cloneNode(false);
	    copy.className=
		((nodeclass.replace(/\b(codexrelocated|codexdup.*)\b/,""))+
		 " codexdup").replace(/\s+/," ").trim();
	    if (nodeclass.search(/\bcodexdupstart\b/)<0)
		node.className=nodeclass+" codexdupstart";
	    if (copy.id) {
		copy.codexid=copy.id;
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
	
	function moveNode(arg,into,blockp){
	    var classname; var node=arg;
	    // If we're moving a first child, we might as well move the parent
	    if (hasParent(node,into)) return node;
	    while ((node.parentNode)&&(node===node.parentNode.firstChild)&&
		   (node.parentNode!==document.body)&&
		   (node.parentNode!==Codex.content)&&
		   (!(hasClass(node.parentNode,"codexpage"))))
		node=node.parentNode;
	    if (node.nodeType===1) classname=node.className;
	    else if (node.nodeType===3) {
		// Wrap text nodes in a span before moving
		var tempnode=fdjtDOM(((blockp)?"div.codextext":"span.codextext"));
		node.parentNode.replaceChild(tempnode,node);
		tempnode.appendChild(node);
		classname="codextext";
		node=tempnode;}
	    if (!(node.getAttribute("data-codexorigin"))) {
		// Record origin information to revert before repagination
		var origin=fdjtDOM("span.codexorigin");
		var id=origin.id="CODEXORIGIN"+(codex_reloc_serial++);
		if (classname) node.className=classname+" codexrelocated";
		else node.className="codexrelocated";
		node.setAttribute("data-codexorigin",id);
		node.parentNode.replaceChild(origin,node);}
	    // fdjtLog("moveNode %o into %o",node,into);
	    into.appendChild(node);
	    return node;}
	
	function moveNodeToPage(node,page,dups){
	    if ((!(page.getAttribute("data-topid")))&&
		(node.id)&&(Codex.docinfo[node.id])) {
		var info=Codex.docinfo[node.id];
		page.setAttribute("data-topid",node.id);
		page.setAttribute("data-sbookloc",info.starts_at);}
	    // fdjtLog("moveNodetoPage(%o,%o)",node,page);
	    if (hasParent(node,page)) return node;
	    var parent=node.parentNode;
	    if ((!(parent)) || (parent===document.body) ||
		(parent===Codex.content) ||
		(hasClass(parent,"codexpage")))
		// You don't need to dup the parent on the new page
		return moveNode(node,page);
	    else {
		var dup_parent=dupContext(parent,page,dups);
		return moveNode(node,dup_parent||page);}}

	function restoreNode(node,info){
	    var originid=node.getAttribute("data-codexorigin");
	    var origin=((originid)&&document.getElementById(originid));
	    if (origin) {
		if (hasClass(node,/\bcodextext\b/g)) {
		    if (hasClass(node,/\bcodextextsplit\b/g))
			origin.parentNode.replaceChild(info.texts[originid],origin);
		    else origin.parentNode.replaceChild(node.childNodes[0],origin);}
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
	    var texts=((state.texts)||(state.texts={}));
	    var split_thresh=((state.hasOwnProperty('split_thresh'))?
			      (state.split_thresh):(state.split_thresh=0.1));
	    if ((typeof split_thresh === 'number') && (split_thresh<1.0)) 
		split_thresh=Math.ceil(page_height*split_thresh);

	    if (state.chunks) state.chunks=state.chunks+1;
	    else state.chunks=1;

	    if (!(state.pagerule)) {
		var pagerule=fdjtDOM.addCSSRule(
		    "div.codexpage",
		    "width: "+page_width+"px; "+"height: "+page_height+"px;");
		state.pagerule=pagerule;}

	    function loop(node){
		var blocks=[], terminals=[];
		node=moveNodeToPage(node,page,dups);
		gatherBlocks(node,blocks,terminals);
		var i=0, n=blocks.length;
		while (i<n) {
		    var block=blocks[i]; var terminal=terminals[i]||false;
		    if ((forcedBreakBefore(block))&&(page.childNodes.length))
			newPage(block);
		    else moveNodeToPage(block,page,dups);
		    var geom=getGeometry(block,page);
		    if (trace>2) fdjtLog("Layout/loop %o %j",block,geom);
		    if ((terminal)&&(geom.bottom>page_height)) {
			if (geom.top>page_height) newPage(block);
			// Just ignore it if it's broke
			else if (hasClass(block,"codexbroke")) i++;
			else blocks[i]=splitBlock(block);}
		    else i++;}}

	    function gatherBlocks(node,blocks,terminals){
		if (node.nodeType!==1) return;
		var disp=getDisplay(node);
		if (disp!=='inline') {
		    var loc=blocks.length; blocks.push(node); 
		    if (avoidBreakInside(node)) terminals[loc]=true;
		    else if ((disp==='block')||(disp==='table')) {
			var children=node.childNodes;
			var total_blocks=blocks.length;
			var i=0; var len=children.length;
			while (i<len) {gatherBlocks(children[i++],blocks,terminals);}
			if (blocks.length==total_blocks) terminals[loc]=true;}
		    else terminals[loc]=true;}}

	    function newPage(node){
		var newpage="pagetop";
		if (!(((page)&&(!(hasContent(page,true))))||
		      ((page)&&(page.firstChild===node)))) {
		    if (page) dropClass(page,"curpage");
		    state.page=page=fdjtDOM("div.codexpage.curpage");
		    pagenum++; state.pagenum=pagenum;
		    page.id="CODEXPAGE"+(pagenum);
		    page.setAttribute("data-pagenum",pagenum);
		    fdjtDOM(pages,page);
		    newpage="newpage";}
		
		if (trace>1) {
		    if (node) fdjtLog("Layout/%s %o at %o",newpage,page,node);
		    else fdjtLog("Layout/%s %o",newpage,page);}
		
		if (node) moveNodeToPage(node,page,dups);

		state.prev=prev=false;
		state.prevstyle=prevstyle=false;
		return page;}

	    function splitBlock(node){
		if (avoidBreakInside(node)) {
		    if (page.firstChild===node) {
			var geom=getGeometry(node,page);
			var scalex=(geom.width/page_width);
			var scaley=(geom.height/page_height);
			var scale=((scalex<scaley)?(scalex):(scaley));
			node.style[fdjtDOM.transform]='scale('+scale+')';
			addClass(node,"codexbroke");}
		    else newPage(node);
		    return node;}
		var children=TOA(node.childNodes);
		var i=children.length-1;
		while (i>=0) node.removeChild(children[i--]);
		var geom=getGeometry(node);
		if (geom.bottom>page_height) {
		    // If the empty version overlaps, just start a new
		    // page on the node after restoring all the children
		    i=0; var n=children.length;
		    while (i<n) node.appendChild(children[i++]);
		    newPage(node);
		    return node;}
		var page_top=false; i=0; var n=children.length;
		while (i<n) {
		    var child=children[i++];
		    node.appendChild(child);
		    geom=getGeometry(node);
		    if (geom.bottom>page_height) { // Over the edge
			if ((child.nodeType===3)||
			    ((child.nodeType===1)&&(hasClass(child,"codextext")))) {
			    // If it's text, split it into words
			    var text=((child.nodeType===3)?(child.nodeValue):
				      (child.firstChild.nodeValue));
			    var words=text.split(/\b/g);
			    var probenode=child;
			    // If there's only one word, no splitting today,
			    //  just push the node itself onto the next page
			    if (words.length<2) {page_top=child; break;}
			    // Try to find where the page should break
			    var w=0; var wlen=words.length; var wordstart;
			    while (w<wlen) {
				wordstart=w++;
				while ((w<wlen)&&(words[w].search(/\w/)<0)) w++;
				var newprobe=document.createTextNode(
				    words.slice(0,w).join(""));
				node.replaceChild(newprobe,probenode);
				probenode=newprobe;
				geom=getGeometry(node);
				if (geom.bottom>page_height) break;}
			    if ((wordstart===0)||(wordstart===wlen)) {
				node.replaceChild(child,probenode);
				page_top=child;}
			    else {
				var keep=document.createTextNode(
				    words.slice(0,wordstart).join(""));
				page_top=document.createTextNode(
				    words.slice(wordstart).join(""));
				node.replaceChild(keep,probenode);
			    	fdjtDOM.insertAfter(keep,page_top);
				// Save texts we've split for restoration before repaginating
				if ((child.nodeType===1)&&(child.getAttribute("data-codexorigin"))) {
				    var originid=child.getAttribute("data-codexorigin");
				    texts[originid]=child.firstChild;}}}
			// If it's an element, just push it over; this
			// could be more clever for inline elements
			else page_top=child;
			break;}
		    else continue;}
		newPage(page_top); var dup=page_top.parentNode;
		while (i<n) dup.appendChild(children[i++]);
		if (trace>1)
		    fdjtLog("Layout/splitBlock %o @ %o into %o on %o",
			    node,page_top,dup,page);
		return dup;}

	    loop(root);
	    
	    return state;}

	/* Pagination support functions */
	
	function forcedBreakBefore(elt,style){
	    var info; var tl;
	    if ((tocmajor)&&(elt.id)&&(info=Codex.docinfo[elt.id])&&
		(tl=info.toclevel)&&(tl<=tocmajor))
		return true;
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakBefore==='always')||
		((sbook_forcebreakbefore)&&
		 (sbook_forcebreakbefore.match(elt)));}

	function forcedBreakAfter(elt,style){ 
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
		((elt.className)&&(elt.className.search(page_block_classes)>=0))||
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

	function progress(info,used,chunks){
	    var started=info.started;
	    var pagenum=info.pagenum;
	    var now=fdjtTime();
	    if (!(pagenum)) return;
	    if (!(Codex._setup)) {
		if (info.done) Codex.startupMessage("Finished page layout");
		else if (info.pagenum)
		    Codex.startupMessage("Laid out %d pages so far",info.pagenum);
		else Codex.startupMessage("Preparing for page layout");}
	    if (info.done)
		if (used)
		    fdjtLog("Done with %d pages after %f seconds (%f running across %d chunks)",
			    pagenum,fdjtTime.secs2short((now-started)/1000),
			    fdjtTime.secs2short(used/1000),chunks)
	    else fdjtLog("Done with %d pages after %f seconds",
			 pagenum,fdjtTime.secs2short((now-started)/1000));
	    else if (typeof pagenum === 'number') {
		fdjtDOM.replace("CODEXPAGEPROGRESS",fdjtDOM("span#CODEXPAGEPROGRESS",pagenum));
		if (Codex.Trace.layout) {
		    if (used)
			fdjtLog("So far, laid out %d pages in %f seconds (%f running across %d chunks)",
				pagenum,fdjtTime.secs2short((now-started)/1000),
				fdjtTime.secs2short(used/1000),chunks);
		    else fdjtLog("So far, laid out %d pages in %f seconds (%f running across %d chunks)",
				 pagenum,fdjtTime.secs2short((now-started)/1000));}}
	    else {}}

	/* Debugging support */

	function _paginationInfo(elt,style,startpage,endpage,nextpage,geom,ngeom,
				 at_top,break_after,force_break){
	    var info=getGeometry(elt,Codex.content);
	    return elt.id+"/t"+(elt.toclevel||0)+
		((at_top)?"/top":"")+
		((break_after)?"/breaknext":"")+
		((force_break)?"/forced":"")+
		((forcedBreakBefore(elt,style))?"/fbb":"")+
		((forcedBreakAfter(elt,style))?"/fba":"")+
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
	    var node;
	    if (!(spec)) return false;
	    else if (typeof spec === 'number')
		return fdjtID("CODEXPAGE"+spec);
	    else if (spec.nodeType) {
		if (hasClass(spec,"codexpage")) return spec;
		else return getParent(spec,".codexpage");}
	    else if (typeof spec === "string")
		return getPageElt(fdjtID(spec));
	    else {
		fdjtLog("Can't determine page from %o",spec);
		return false;}}

	function GoToPage(spec,caller){
	    var page=getPageElt(spec)||fdjtID("CODEXPAGE1");
	    var pagenum=parseInt(page.getAttribute("data-pagenum"));
	    if (Codex.Trace.flips)
		fdjtLog("GoToPage/%s Flipping to %o (%d) for %o",
			caller,page,pagenum,spec);
	    if (curpage) dropClass(curpage,"curpage");
	    addClass(page,"curpage");
	    if (typeof spec === 'number') {
		var location=parseInt(page.getAttribute("data-sbookloc"));
		Codex.setLocation(location);}
	    updatePageDisplay(pagenum,Codex.location);
	    curpage=page; Codex.curpage=pagenum;}
	Codex.GoToPage=GoToPage;
	
	function getPage(elt){
	    var page=getPageElt(elt)||fdjtID("CODEXPAGE1");
	    return parseInt(page.getAttribute("data-pagenum"));}
	Codex.getPage=getPage;
	
	function getPageAt(loc){
	    var elt=Codex.resolveLocation(loc);
	    return getPage(elt)||fdjtID("CODEXPAGE1");}
	Codex.getPageAt=getPageAt;
	
	function displaySync(){
	    if ((Codex.pagecount)&&(Codex.curpage))
		Codex.GoToPage(Codex.curpage,"displaySync");}
	Codex.displaySync=displaySync;

	/* External refs */
	Paginate.forcedBreakBefore=forcedBreakBefore;
	Paginate.forceBreakBefore=forcedBreakBefore;
	Paginate.avoidBreakInside=avoidBreakInside;
	Paginate.forcedBreakAfter=forcedBreakAfter;
	Paginate.forceBreakAfter=forcedBreakAfter;
	Paginate.avoidBreakAfter=avoidBreakAfter;
	Paginate.avoidBreakBefore=avoidBreakBefore;
	Paginate.debug=debug_pagination;
	
	/* Top level functions */
	
	function repaginate(newinfo){
	    var oldinfo=Codex.paginated;
	    var moved=TOA(document.getElementsByClassName("codexrelocated"));
	    if ((moved)&&(moved.length)) {
		fdjtLog("Restoring original layout of %d relocated nodes and %d texts",
			moved.length);
		var i=0; var lim=moved.length;
		while (i<lim) restoreNode(moved[i++],oldinfo);}
	    dropClass(document.body,"codexscrollview");
	    addClass(document.body,"codexpageview");
	    fdjtID("CODEXPAGE").style.visibility='hidden';
	    var newpages=fdjtDOM("div.codexpages#CODEXPAGES");
	    var newinfo=((newinfo)||{"pages": newpages});
	    fdjtDOM.replace("CODEXPAGES",newpages);
	    var content=Codex.content;
	    var nodes=TOA(content.childNodes);
	    if (!(newinfo.page_height))
		newinfo.page_height=getGeometry(fdjtID("CODEXPAGE")).height;
	    if (!(newinfo.page_width))
		newinfo.page_width=getGeometry(fdjtID("CODEXPAGE")).width;
	    fdjtLog("Laying out %d root nodes into %dx%d pages",
		    nodes.length,newinfo.page_width,newinfo.page_height);
	    fdjtTime.slowmap(
		function(node){if (node.nodeType===1) newinfo=Paginate(node,newinfo);},nodes,
		function(state,i,lim,chunks,used,zerostart){
		    if (state==='suspend') progress(newinfo,used,chunks);
		    else if (state==='done')
			fdjtLog("Layout/%d HTML blocks across %d pages after %dms, taking %fms over %d chunks",
				lim,newinfo.pagenum,fdjtTime()-zerostart,
				used,chunks);},
		function(){
		    var dups=newinfo.dups;
		    var i=0; var lim=dups.length;
		    for (dupid in dups) {
			var dup=dups[dupid];
			dup.className=dup.className.replace(
				/\bcodexdup\b/,"codexdupend");}
		    if (newinfo.page) dropClass(newinfo.page,"curpage");
		    newinfo.done=fdjtTime();
		    progress(newinfo);
		    fdjtID("CODEXPAGE").style.visibility='visible';
		    Codex.paginated=newinfo;
		    Codex.pagecount=newinfo.pagenum;
		    if (Codex.pagewait) {
			var fn=Codex.pagewait;
			Codex.pagewait=false;
			fn();}
		    Codex.GoTo(Codex.location||Codex.target);
		    Codex.paginating=false;},
		200,50);}


	Codex.depaginate=function(drop_old) {
	    var oldinfo=Codex.paginated;
	    var moved=TOA(document.getElementsByClassName("codexrelocated"));
	    if ((moved)&&(moved.length)) {
		fdjtLog("Restoring original layout of %d relocated nodes and %d texts",
			moved.length);
		var i=0; var lim=moved.length;
		while (i<lim) restoreNode(moved[i++],oldinfo);}
	    if (drop_old) {
		var newpages=fdjtDOM("div.codexpages#CODEXPAGES");
		fdjtDOM.replace("CODEXPAGES",newpages);}};

	
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
