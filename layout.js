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
	    // If we're moving a first child, we might as well move the parent
	    while (node===node.parentNode.firstChild)
		node=node.parentNode;
	    if (node.nodeType===1) classname=node.className;
	    else if (node.nodeType===3) {
		// Wrap text nodes in a span before moving
		var tempnode=fdjtDOM("span.codextext");
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
	    into.appendChild(node);
	    return node;}
	
	function moveNodeToPage(node,page,dups){
	    if ((!(page.getAttribute("data-topid")))&&
		(node.id)&&(Codex.docinfo[node.id])) {
		var info=Codex.docinfo[node.id];
		page.setAttribute("data-topid",node.id);
		page.setAttribute("data-sbookloc",info.starts_at);}
	    if (hasParent(node,page)) return;
	    var parent=node.parentNode;
	    if ((!(parent)) || (parent===document.body) ||
		(parent.id==="CODEXCONTENT") ||
		(hasClass(parent,"codexpage")))
		moveNode(node,page);
	    else {
		var adoptive=dupContext(parent,page,dups);
		moveNode(node,adoptive||page);}}

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
		if (node.nodeType===3) {
		    var textnode=fdjtDOM("span.codextext");
		    node.parentNode.replaceChild(textnode,node);
		    textnode.appendChild(node);
		    moveNodeToPage(node,page,dups);
		    node=textnode;}
		else if (node.nodeType!==1) return;
		var style=getStyle(node);
		if (forcedBreakBefore(node,style)) newPage();
		else if (forcedBreakAfter(prev,prevstyle)) newPage();
		else {}
		moveNodeToPage(node,page,dups);
		var geom=getGeometry(node,page);
		var classname=node.className;
		if (trace>2) fdjtLog("PG/loop %o g=%j",node,geom);
		if ((geom.bottom>page_height))
		    return forceBreak(node,geom,style);
		else if (trace>2)
		    fdjtLog("PG/placed %o on %o",node,page);
		else {}
		prev=node; prevstyle=style;}
	    function forceBreak(node,geom,style){
		if ((style.pageBreakInside==='avoid')) {
		    // If we're avoiding a break here, we just make the break happen
		    if ((avoidBreakBefore(node,style))||
			((prev)&&(avoidBreakAfter(prev,prevstyle)))) {
			if (trace>1) fdjtLog("PG/keep/forceprev %o g=%j",node,geom);
			newPage(prev); loop(node);}
		    else {
			if (trace>1) fdjtLog("PG/keep/forced %o g=%j",node,geom);
			// This won't try to split 'node' any further
			// (which it shouldn't), so you might get an
			// overflow for really big nodes.
			newPage(node);}}
		else if ((split_thresh)&&((geom.top+split_thresh)>page_height)) {
		    if (trace>2) fdjtLog("PG/forceblock %o g=%j",node,geom);
		    newPage();
		    loop(node);}
		else if (hasClass(node,/\bcodextext\w*\b/)) {
		    if (trace>2) fdjtLog("PG/splittext %o g=%j",node,geom);
		    splitNode(node);}
		else if (style.display!=='inline') { 
		    if (trace>2) fdjtLog("PG/splitnode %o g=%j",node,geom);
		    splitNode(node);}
		else {
		    if (trace>1) fdjtLog("PG/forced %o g=%j",node,geom);
		    newPage(node);}
		prev=node; prevstyle=style;}
	    function newPage(node){
		if ((page)&&(!(hasContent(page,true)))) return page;
		if (page) dropClass(page,"curpage");
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

	    // New model:
	    //  We can't get the geometry of inline or text elements, so we proceed as follows:
	    //   loop should never be called on a text or inline element
	    //   when called on a node which is split over the bottom of the page,
	    //    call getBreakNode to get the loopable node which is athwart
	    //      the bottom of the page; if the break occurs in the content
	    //      between two block level elements, that content is aggregated into
	    //      a codexrun div.

	    function getBreakNode(node){
		var geom=getGeometry(node,page);
		if (geom.bottom<page_height) return false;
		else if (geom.top>page_height) return true;
		else {
		    var children=node.childNodes;
		    var i=0; var n=children.length; var runstart=0;
		    while (i<n) {
			var child=children[i]; var disp, broke;
			if (child.nodeType!==1) i++;
			else if ((disp=displayStyle(child))==='inline') i++;
			else if (avoidBreakInside(child)) return child;
			else if (disp==='block') {
			    var broke=getBreakNode(child);
			    if (!(broke)) {i++; runstart=i;}
			    else if (broke.nodeType) return broke;
			    else if (run) {
				var run=[];
				var runblock=fdjtDOM("div.codexrun");
				while (runstart<i) run.push(children[runstart++]);
				var j=0; var jlim=run.length;
				fdjtDOM.replace(run[0],runblock);
				while (j<jlim) runblock.appendChild(run[j++]);
				return runblock;}
			    else return child;}
			else i++;}
		    return node;}}
	    
	    function splitNode(node){
		var children=TOA(node.childNodes);
		var i=children.length-1;
		while (i>=0) node.removeChild(children[i--]);
		var geom=getGeometry(node);
		if (geom.bottom>page_height) {
		    // If the empty version overlaps, just start a new page on the node
		    i=0; var n=children.length; while (i<n) node.appendChild(children[i++]);
		    newPage(node);
		    // danger of infinite recursion?
		    loop(node);}
		i=0; var n=children.length; while (i<n) {
		    var child=children[i++];
		    if (child.nodeType!==3) {
			// If it's just a node, append it, don't try to split it
			//     (this is fine because we presume that we called getBreakNode
			//      to get the smallest block to split)
			node.appendChild(child);
			geom=getGeometry(node);}
		    else {
			// This is where we split a text block by breaking it into words.
			//  We might try handling hyphens and soft hyphens here in the future.
			var textnode=child; var probenode=child;
			// The main idea is that we add words until we go over the edge and
			// then we split off the remaining text into an extra node at the top
			// of the new page.
			node.appendChild(probenode);
			geom=getGeometry(node);
			// This is the case where the text node as a whole doesn't put us over
			// the edge, so we don't need to try splitting it apart
			if (geom.bottom<page_height) {i++; continue;}
			// Okay, we're going to go all Sweeney Todd and chop the text into
			// pieces to make it fit.
			var text=textnode.nodeValue;
			var words=text.split(/\b/g);
			// If there aren't any words to try, we pretty much need to break on
			// this text node by itself (long word?), so we just fall through the
			// conditional; a new page will start with the text node at its head.
			if (words.length>=2) {
			    var w=0; var wlen=words.length;
			    while (w<wlen) {
				// Probe with a string including the word that starts at 'w'
				var wordstart=w++;
				while ((w<wlen)&&(words[w].search(/\w/)<0)) w++;
				var newprobe=document.createTextNode(words.slice(0,w).join(""));
				node.replaceChild(newprobe,probenode); probenode=newprobe;
				geom=getGeometry(node);
				if (geom.bottom>page_height) { // Over the edge! Wheeeeeeee!
				    if (wordstart===0) {
					// Break the whole thing
					node.replaceChild(textnode,probenode);
					break;}
				    // fitsnode is on this page, remainder will be on the next
				    var remainder=document.createTextNode(
					words.slice(wordstart).join(""));
				    var fullnode=fdjtDOM(
					"span.codextext",words.slice(0,wordstart).join(""));
				    fullnode.id="CODEXORIGIN"+(codex_reloc_serial++);
				    texts[fullnode.id]=textnode;
				    node.replaceChild(fullnode,probenode);
				    fdjtDOM.insertAfter(fullnode,remainder);
				    child=remainder;
				    break;}}}}
		    if (geom.bottom>page_height) {
			newPage(child); var dup=child.parentNode;
			while (i<n) dup.appendChild(children[i++]);
			return loop(dup);}}}

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
		else return getParent(spec,"codexpage");}
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
		function(node){newinfo=Paginate(node,newinfo);},nodes,
		function(state,i,lim,chunks,used,zerostart){
		    if (state==='suspend') progress(newinfo,used,chunks);
		    else if (state==='done')
			fdjtLog("PG/laid out %d HTML blocks across %d pages after %dms, taking %fms over %d chunks",
				newinfo.pagenum,lim,fdjtTime()-zerostart,
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
