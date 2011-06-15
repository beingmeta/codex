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
	var debug_pagination=false;
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
	var getStyle=fdjtDOM.getStyle;
	var parsePX=fdjtDOM.parsePX;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var nextElt=fdjtDOM.nextElt;
	var forward=fdjtDOM.forward;
	
	var sbook_body=false;
	var page_width=false;
	var page_height=false;
	var page_gap=false;
	var flip_width=false;
	var offset_left=false;
	
	var runslice=100; var runwait=50;

	var dropClass=fdjtDOM.dropClass;
	var addClass=fdjtDOM.addClass;

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

	// Whether the DOM geometry reflects conversion into columns or not
	// (Gecko does, Webkit doesnt)
	var talldom=Codex.talldom;

	function Paginate(callback){
	    var start_time=fdjtTime(); var chunks=0;
	    var page=Codex.page;
	    var pages=Codex.pages;
	    var content=Codex.content;
	    var booktop=(fdjtDOM.getGeometry(content).top);
	    var vwidth=fdjtDOM.viewWidth();
	    var vheight=fdjtDOM.viewHeight();
	    var height=page.offsetHeight;
	    var width=page.offsetWidth;
	    var gap=vwidth-width;
	    var forced=[]; var pagetops=[]; var forced_off=[];
	    var debug=Paginate.debug;
	    var trace=Codex.Trace.layout;
	    var curpage=-1;
	    var scan=scanContent(content);
	    var geom=getGeometry(scan,content);
	    var style=getStyle(scan);
	    var next=scanContent(scan,style);
	    var ngeom=getGeometry(next,content);
	    var nstyle=getStyle(next);
	    var prev=false, pgeom=false, pstyle=false;
	    var colbreak=Codex.colbreak;
	    if ((trace)||((!(Codex._setup))&&(Codex.Trace.startup)))
		fdjtLog("Starting page layout");
	    var fullpages;
	    fdjtDOM.replace("CODEXPAGEPROGRESS",
			    fdjtDOM("span#CODEXPAGEPROGRESS","0"));
	    fdjtTime.timeslice
	    ([initLayout,
	      adjustFullPages,adjustFullPages,
	      adjustFullPages,adjustFullPages,
	      finishFullPages,// scaleFullPages,
	      ((Codex.colbreak)&&(handleDeclaredBreaks())),
	      forceBreaks]);
	    /* Here are the parts of the process */
	    function scanStep() {
		var top=geom.top; var bottom=top+geom.height;
		var starts_at=(top/height);
		var ends_at=(bottom/height);
		var startpage=Math.floor(starts_at);
		var endpage=Math.floor(ends_at);
		// Simulate 32 for lineheight
		var nextpage=((ngeom)&&
			      (Math.floor(((ngeom.top+32)/height))));
		var at_top=(((geom.top/height)%1)<0.001);
		var break_after=((next)&&(nextpage>endpage));
		var forcebreak=true;
		if (forced.length===0) {
		    forced.push(scan); forced_off.push(booktop);
		    pagetops.push(scan);}
		if (forceBreakBefore(scan,style)) forceBreak(scan,false);
		else if (((avoidBreakInside(scan,style))||
			  (avoidBreakAfter(scan,style)))&&
			 (endpage>startpage)&&(nextpage>startpage))
		    forceBreak(scan,prev);
		else if ((next)&&(forceBreakAfter(scan,style)))
		    forceBreak(next,prev);
		else if ((break_after)&&(avoidBreakAfter(scan,style)))
		    forceBreak(scan,prev);
		else if ((break_after)&&(avoidBreakBefore(next,nstyle)))
		    forceBreak(scan,prev);
		else if (at_top) {
		    forced.push(scan);
		    forced_off.push(((Math.floor(geom.top/height))*height));
		    pagetops.push(scan);
		    forcebreak=false;}
		else forcebreak=false;
		var newpage=
		    Math.floor((talldom)?(geom.top/height):(geom.left/vwidth));
		if (newpage!==curpage) {
		    pagetops[newpage]=scan;
		    curpage=newpage;}
		if (debug)
		    scan.setAttribute(
			"codexdbg",
			_paginationInfo(scan,style,startpage,endpage,nextpage,
					geom,ngeom,at_top,break_after,forcebreak));
		prev=scan; pgeom=geom; pstyle=style;
		scan=next; style=nstyle;
		geom=((scan)&&(getGeometry(scan,content)));
		if (scan) {
		    next=scanContent(scan,style);
		    nstyle=((next)&&(getStyle(next)));
		    ngeom=((next)&&(getGeometry(next,content)));}
		else next=nstyle=ngeom=null; 
		// This might be neccessary if we have to yield to
		//   let the DOM update, which doesn't seem to be the case
		// if (forcebreak) return forcebreak;
		return forcebreak;}
	    function forceBreaks(){
		var now=fdjtTime();
		var stopblock=now+runslice;
		while ((scan)&&(now<stopblock)) {
		    if (scanStep()) break;
		    else now=fdjtTime();}
		if (scan) {
		    chunks++;
		    page_progress(curpage);
		    if (now<stopblock)
			setTimeout(forceBreaks,10);
		    else setTimeout(forceBreaks,runwait);}
		else {
		    finishUp(); chunks++;
		    page_progress(true);
		    if (callback) callback();}}
	    function initLayout(){
		// Clear forced breaks
		if (Codex.forced_breaks)
		    dropClass(Codex.forced_breaks,"codexpagebreak");
		Codex.forced_breaks=[];
		// Set up the column layout
		content.style.maxWidth=(width)+"px";
		/*
		content.style.maxWidth=(width-32)+"px";
		content.style.marginRight="16px";
		if (talldom) 
		    content.style.marginLeft=
		    (32-(Math.floor((vwidth-width)/2)))+"px";
		else content.style.marginLeft="0px";
		*/
		pages.style.height=height+"px";
		pages.style[fdjtDOM.columnWidth]=width+"px";
		pages.style[fdjtDOM.columnGap]=(vwidth-width)+"px";
		// Figure out whether column layout is expressed in the DOM
		var content_dim=getGeometry(content,pages);
		Codex.talldom=talldom=(!(content_dim.width>vwidth));
		// Get the fullsized pages
		fullpages=getFullPages();}
	    function forceBreak(elt,prev){
		var parent=elt.parentNode;
		// If you're directly inside a page break, don't bother breaking
		if ((parent===prev)&&
		    ((hasClass((parent),"codexpagebreak"))||
		     (hasClass((parent),"codexpagebroke")))) {
		    addClass(elt,"codexpagebroke");
		    if ((trace)&&(typeof trace === 'number')&&(trace>1))
			fdjtLog("forceBreak/skip%s@%o h=%o parent=%s",
				fdjtString(elt),newpage,height,
				fdjtString(parent));
		    if (debug)
			elt.setAttribute(
			    "codexpagebreak",
			    fdjtString("forceBreak/skip%s@%o h=%o parent=%s",
				       fdjtString(elt),newpage,height,
				       fdjtString(parent)));
		    return;}
		var g=getGeometry(elt,content);
		var target_off;
		var oldpage=Math.floor(((g.top-booktop)/height));
		var newpage=oldpage+1;
		if (Codex.colbreak) {
		    if (hasClass(elt,"codexpagebreak")) return;
		    if ((prev)&&
			((avoidBreakAfter(prev))||(avoidBreakBefore(elt)))) {
			parent=prev.parentNode;
			if (((hasClass(parent,"codexpagebreak"))||
			     (hasClass(parent,"codexpagebroke")))&&
			    (scanContent(parent)===prev))
			    addClass(prev,"codexpagebroke");
			else addClass(prev,"codexpagebreak");}
		    else addClass(elt,"codexpagebreak");
		    if ((trace)&&(typeof trace === 'number')&&(trace>1))
			fdjtLog("forceBreak%s@%o h=%o geom=%s",
				fdjtString(elt),newpage,height,
				JSON.stringify(g));
		    if (debug)
			elt.setAttribute("codexpagebreak",
					 fdjtString("forceBreakCSS%s@%o h=%o geom=%s",
						    fdjtString(elt),newpage,height,
						    JSON.stringify(g)));}
		else {
		    // Some browsers don't recognize columnBreakBefore, so
		    // we check that the change actually worked (assuming
		    // synchronous DOM updates) and go kludgier if it
		    // didn't
		    var style=elt.style;
		    var top_margin=0;
		    // We have to kludge the margin top, and first we
		    // get the geometry without any existing margin
		    style.setProperty("margin-top","0px","important");
		    g=getGeometry(elt,content);
		    var pageoff=((newpage)*height);
		    target_off=pageoff;
		    top_margin=(pageoff-g.top);
		    if ((trace)&&(typeof trace === 'number')&&(trace>1))
			fdjtLog("forceBreak%s@%o h=%o off=%o tm=%o geom=%s",
				fdjtString(elt),newpage,height,pageoff,top_margin,
				JSON.stringify(g));
		    if (debug)
			elt.setAttribute(
			    "codexpagebreak",
			    fdjtString("forceBreakMargin%s@%o h=%o off=%o tm=%o geom=%s",
				       fdjtString(elt),newpage,height,pageoff,top_margin,
				       JSON.stringify(g)));
		    if (top_margin<0) {
			fdjtLog("Negative top margin %d for %o",top_margin,elt);
			top_margin=0;}
		    else top_margin=top_margin%height;
		    style.setProperty("margin-top",
				      (Math.floor(top_margin))+"px",
				      "important");}
		// Update geometries, assuming the DOM is updated synchronously
		if (scan) geom=getGeometry(scan,content);
		if (next) ngeom=getGeometry(next,content);
		if (prev) pgeom=getGeometry(prev,content);
		if ((trace)&&(typeof trace === 'number')&&(trace>1))
		    fdjtLog("forcedBreak%s/after geom=%s",
			    fdjtString(prev),JSON.stringify(geom));
		pagetops.push(elt);
		forced.push(elt);
		forced_off.push(target_off);
		forced_off.push();}
	    function handleDeclaredBreaks() {
		var breaks=fdjtDOM.getChildren(content,"forcebreakbefore");
		var i=0; var lim=breaks.length;
		while (i<lim) forceBreak(breaks[i++],false);
		if (sbook_forcebreakbefore) {
		    var breaks=fdjtDOM.getChildren
		    (content,sbook_forcebreakbefore);
		    var i=0; var lim=breaks.length;
		    while (i<lim) forceBreak(breaks[i++],false);}}
	    function finishUp() {
		pages.style[fdjtDOM.columnWidth]=width+"px";
		pages.style[fdjtDOM.columnGap]=(vwidth-width)+"px";
		var content_dim=getGeometry(content,pages);
		var pagecount=Codex.pagecount=
		    ((content_dim.width>vwidth)?
		     (Math.ceil(content_dim.width/vwidth)):
		     (Math.ceil(content_dim.height/height)));
		pages.style.maxWidth=(pagecount*vwidth)+"px";
		pages.style.minWidth=((pagecount*vwidth)-gap)+"px";
		var i=0; while (i<pagecount) {
		    var top=forced[i]; var off=forced_off[i];
		    if (!(top)) {i++; continue;}
		    var margin=parsePX(top.style.marginTop);
		    var g=fdjtDOM.getGeometry(top,content);
		    if (g.top!==off) {
			var new_margin=((off-(g.top-margin))%height);
			if (new_margin<=0)
			    top.style.marginTop="0 px";
			else top.style.marginTop=new_margin+"px";}
		    i++;}
		Codex.page_width=width;
		Codex.page_gap=page_gap=gap;
		Codex.page_height=height;
		var content_style=getStyle(Codex.content);
		Codex.offset_left=offset_left=parsePX(style.marginLeft)+parsePX(style.borderLeft)+parsePX(style.paddingLeft);
		Codex.left_margin=page.offsetLeft;
		Codex.top_margin=page.offsetTop;
		Codex.right_margin=vwidth-(page.offsetLeft+page.offsetWidth);
		Codex.bottom_margin=vheight-(page.offsetTop+page.offsetHeight);
		Codex.vwidth=vwidth;
		Codex.vheight=vheight;
		// getGeometry(Codex.content).width+parsePX(getStyle(Codex.content).marginLeft)+parsePX(getStyle(Codex.content).marginRight)
		Codex.flip_width=flip_width=gap+width;
		Codex.pagetops=pagetops;
		Codex.forced_breaks=forced;
		Codex.forced_off=forced_off;}
	    function getFullPages(){
		var pages=
		    fdjtDOM.$(".sbookfullpage,.sbookcover,.sbooktitlepage,.fullpage,.titlepage");
		if (sbook_fullpages)
		    pages=pages.concat(fdjtDOM.$(sbook_fullpages));
		var i=0; var lim=pages.length;
		while (i<lim) {
		    var block=pages[i++];
		    block.style.maxHeight=height+'px';
		    block.style.maxWidth=width+'px';}
		return pages;}
	    function adjustFullPages(){
		var i=0; var lim=fullpages.length;
		while (i<lim) {
		    var block=fullpages[i++];
		    if (block.tagName!=='IMG')
			fdjtDOM.adjustToFit(block,0.1,24);}}
	    function finishFullPages(){
		var i=0; var lim=fullpages.length;
		while (i<lim)
		    if (fullpages[i].tagName!=='IMG')
			fdjtDOM.finishScale(fullpages[i++]);
		else i++;}
	    function scaleFullPages(){
		// Direct scaling doesn't seem to interact well with
		// horizontal scrolling
		// This uses CSS transformation
		var i=0; var lim=fullpages.length;
		while (i<lim) {
		    var block=fullpages[i++];
		    var scaleby=1.0;
		    if (true) {
			var bwidth=block.offsetWidth;
			var bheight=block.offsetHeight;
			scaleby=Math.min(width/bwidth,height/bheight);
			block.style[fdjtDOM.transform]="scale("+scaleby+")";
			block.style.transform="scale("+scaleby+")";}}
		Codex.startupMessage("Scaled %d full-size pages",lim);}
	    function page_progress(arg){
		var now=fdjtTime();
		if (!(Codex._setup)) {
		    if (typeof arg === 'number')
			Codex.startupMessage("Laid out %d pages so far",arg);
		    else Codex.startupMessage("Finished page layout");}
		if (!(arg)) {}
		else if (typeof arg === 'number') {
		    fdjtDOM.replace("CODEXPAGEPROGRESS",
				    fdjtDOM("span#CODEXPAGEPROGRESS",arg));
		    if (trace)
			fdjtLog("So far, laid out %d pages (%d thunks) in %f seconds",
				arg,chunks,
				fdjtTime.secs2short((now-start_time)/1000));}
		else if ((trace)||((!(Codex._setup))&&(Codex.Trace.startup)))
		    fdjtLog("Done with %d pages (in %d chunks) after %f seconds (rt~%f)",
			    Codex.pagecount,chunks,
			    fdjtTime.secs2short((now-start_time)/1000),
			    fdjtTime.secs2short(chunks*(1/runslice)));
		else {}}}
	
	function clearPagination(){
	    /* Reset pageination info */
	    var pages=Codex.pages;
	    pages.style.height="";
	    pages.style[fdjtDOM.columnWidth]="";
	    pages.style[fdjtDOM.columnGap]="";}
	
	/* Pagination support functions */

	function forceBreakBefore(elt,style){
	    if ((sbook_tocmajor)&&(elt.id)&&
		((Codex.docinfo[elt.id]).toclevel)&&
		(((Codex.docinfo[elt.id]).toclevel)<=sbook_tocmajor))
		return true;
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakBefore==='always')||
		((sbook_forcebreakbefore)&&(sbook_forcebreakbefore.match(elt)));}

	function forceBreakAfter(elt,style){ 
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakAfter==='always')||
		((sbook_forcebreakafter)&&(sbook_forcebreakafter.match(elt)));}

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

	/* Scanning the content */

	var nextfn=fdjtDOM.next;
	function scanContent(start,style,skipchildren){
	    var scan=start; var next=null;
	    // Get out of the UI
	    if (scan.sbookui) while ((scan)&&(scan.sbookui)) scan=scan.parentNode;
	    if (avoidBreakInside(scan,((scan===start)?(style):(getStyle(scan))))) {
		while (!(next=nextfn(scan,isContentBlock))) scan=scan.parentNode;}
	    else next=forward(scan,isContentBlock);
	    if ((next)&&(Paginate.debug)) {
		if (next.id) scan.setAttribute("codexnextcontent",next.id);
		if (start.id) next.setAttribute("codexprevcontent",start.id);}
	    return next;}
	Codex.scanContent=scanContent;

	var sbook_block_tags=
	    {"IMG": true, "HR": true, "P": true, "DIV": true,
	     "UL": true,"BLOCKQUOTE":true};

	function isContentBlock(node,style){
	    var styleinfo;
	    if (node.nodeType===1) {
		if (node.sbookui) return false;
		else if (sbook_block_tags[node.tagName]) return true;
		else if (styleinfo=((style)||getStyle(node))) {
		    if (styleinfo.position!=='static') return false;
		    else if ((styleinfo.display==='block')||
			     (styleinfo.display==='list-item')||
			     (styleinfo.display==='table'))
			return true;
		    else return false;}
		else if (fdjtDOM.getDisplay(node)==="inline") return false;
		else return true;}
	    else return false;}
	
	/* Debugging support */

	function _paginationInfo(elt,style,startpage,endpage,nextpage,geom,ngeom,
				 at_top,break_after,force_break){
	    var info=getGeometry(elt,Codex.content);
	    return elt.id+"/t"+(elt.toclevel||0)+
		((at_top)?"/top":"")+
		((break_after)?"/breaknext":"")+
		((force_break)?"/forced":"")+
		((forceBreakBefore(elt,style))?"/ph":"")+
		((avoidBreakInside(elt,style))?"/pb":"")+
		((avoidBreakBefore(elt,style))?"/ah":"")+
		((avoidBreakAfter(elt,style))?"/af":"")+
		((fdjtDOM.hasText(elt,style))?"/ht":"")+
		((endpage!==nextpage)?"/af/ba":"")+
		"/sp="+startpage+"/ep="+endpage+"/np="+nextpage+
		" ["+
		info.width+"x"+info.height+"@"+
		info.top+","+info.left+
		"] g=["+(JSON.stringify(geom))+
		"] ng=["+(JSON.stringify(ngeom))+"]";}

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

	function GoToPage(num,caller,nosave){
	    var off;
	    off=(num*(flip_width));
	    /*
	    if (talldom) off=(num*(flip_width));
	    else {
		var top=Codex.pagetops[num];
		var geom=fdjtDOM.getGeometry(top,Codex.content);
		var pageleft=geom.left-getCSSLeft(top,Codex.content);
		off=pageleft;}
	    */
	    if (Codex.Trace.nav)
		fdjtLog("GoToPage%s %o",((caller)?"/"+caller:""),pageno);
	    Codex.pages.style.setProperty
	    (fdjtDOM.transform,
	     "translate("+(-off)+"px,0px)",
	     "important");
	    var ptop=Codex.pagetops[num];
	    while (ptop) {
		if ((ptop.id)&&(Codex.docinfo[ptop.id])) break;
		else ptop=ptop.parentNode;}
	    if (ptop) {
		var info=Codex.docinfo[ptop.id];
		updatePageDisplay(num,info.starts_at);}
	    Codex.curpage=num;
	    if (false) /* (!(nosave)) to fix */
		Codex.setState
	    ({page: pageno,location: info.loc,
	      target:((Codex.target)&&(Codex.target.id))});}
	Codex.GoToPage=GoToPage;
	
	function getPage(elt){
	    if (typeof elt === 'string') elt=fdjtID(elt);
	    if (!(elt)) return 0;
	    var vwidth=fdjtDOM.viewWidth();
	    var content_dim=fdjtDOM.getGeometry(Codex.content,Codex.pages);
	    var geom=fdjtDOM.getGeometry(elt,Codex.content);
	    var boxheight=Codex.page.offsetHeight;
	    return ((content_dim.width>vwidth)?
		    (Math.floor(geom.left/vwidth)):
		    (Math.floor(geom.top/Codex.page_height)))
	    return elt.offsetTop/boxheight;}
	Codex.getPage=getPage;
	
	function getPageAt(loc){
	    var elt=Codex.resolveLocation(loc);
	    return getPage(elt);}
	Codex.getPageAt=getPageAt;
	
	function displaySync(){
	    if (Codex.pagecount)
		Codex.GoToPage(Codex.curpage,"displaySync");}
	Codex.displaySync=displaySync;

	/* External refs */
	Paginate.forceBreakBefore=forceBreakBefore;
	Paginate.avoidBreakInside=avoidBreakInside;
	Paginate.forceBreakAfter=forceBreakAfter;
	Paginate.avoidBreakAfter=avoidBreakAfter;
	Paginate.avoidBreakBefore=avoidBreakBefore;
	Paginate.isContentBlock=isContentBlock;
	Paginate.scanContent=scanContent;
	Paginate.debug=debug_pagination;
	
	/* Updates */
	
	/* Top level functions */
	
	function repaginate(){
	    var newinfo={};
	    dropClass(document.body,"codexscrollview");
	    addClass(document.body,"codexpageview");
	    addClass(Codex.page,"codexpaginating");
	    clearPagination();
	    Paginate(function(){
		newinfo.offheight=document.body.offsetHeight;
		newinfo.offwidth=document.body.offsetWidth;
		newinfo.winwidth=(document.documentElement.clientWidth);
		newinfo.winheight=(fdjtDOM.viewHeight());
		sbook_paginated=newinfo;
		Codex.paginated=newinfo;
		addClass(document.body,"codexpageview");
		dropClass(Codex.page,"codexpaginating");
		if (Codex.location) {
		    var gotopage=Codex.getPageAt(Codex.location);
		    Codex.GoToPage(gotopage||0,"repaginate",true);}
		if (Codex.pagewait) {
		    var fn=Codex.pagewait;
		    Codex.pagewait=false;
		    fn();}});}
	
	var repaginating=false;
	Codex.repaginate=function(){
	    if (repaginating) return;
	    repaginating=setTimeout(function(){
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
