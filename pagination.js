/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

var codex_pagination_id=
    "$Id$";
var codex_pagination_version=parseInt("$Revision$".slice(10,-1));

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

/* Pagination predicates */

/* Pagination loop */

var sbookPaginate=
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
	var flipwidth=false;
	
	var runslice=100; var runwait=100;

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
	sbookPaginate.readSettings=readSettings;

	/* Adjust full pages */

	function adjustFullPages(alldone){
	    var fullpages=fdjtDOM.$(".sbookfullpage");
	    if (sbook_fullpages)
		fullpages=fullpages.concat(fdjtDOM.$(sbook_fullpages));
	    var i=0; var lim=fullpages.length;
	    while (i<lim) {
		var block=fullpages[i++];
		var blockstyle=getStyle(block);
		block.style.maxHeight=page_height+'px';
		block.style.maxWidth=page_width+'px';}
	    var adjustpages=function(){
		i=0; while (i<lim) {
		    var block=fullpages[i++];
		    fdjtDOM.adjustToFit(block,0.1,24);}
		document.body.className=document.body.className;};
	    var finish_scaling=function(){
		i=0; while (i<lim) fdjtDOM.finishScale(fullpages[i++]);
		document.body.className=document.body.className;};
	    var finalizepages=function(){
		var page=fdjtID("CODEXPAGE");
		var geom=fdjtDOM.getGeometry(page);
		var pwidth=geom.width; var pheight=geom.height;
		// Direct scaling doesn't seem to interact well with
		// horizontal scrolling
		    // This uses CSS transformation
		    i=0; while (i<lim) {
			var block=fullpages[i++];
			var scaleby=1.0;
			if (false) { // (!(Codex.colpage))
			    var bwidth=block.offsetWidth;
			    var bheight=block.offsetHeight;
			    scaleby=Math.min(pwidth/bwidth,pheight/bheight);
			    block.style[fdjtDOM.transform]="scale("+scaleby+")";
			    block.style.transform="scale("+scaleby+")";}
			// block.style.width=(pwidth*(1/scaleby))+'px';
			// block.style.height=(pheight*(1/scaleby))+'px';
		    }
		document.body.className=document.body.className;};
	    fdjtTime.timeslice
	    ([adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
	      // adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
	      finish_scaling,finalizepages,alldone],
	     0,100);}

	/* Updating the page display */

	function updatePageDisplay(pagenum,location) {
	    var npages=Codex.pagecount;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=Codex.ends_at;
	    pbar.style.left=(100*(pagenum/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff=fdjtDOM("span.locoff#CODEXLOCOFF","L"+Math.floor(location/128));
	    var pageno_text=fdjtDOM("span#CODEXPAGENOTEXT.pageno",pagenum+1,"/",npages);
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
	var talldom=true;

	function Paginate(callback){
	    var start_time=fdjtTime(); var chunks=0;
	    var page=Codex.page;
	    var pages=Codex.pages;
	    var content=Codex.content;
	    var booktop=fdjtDOM.getGeometry(content).top;
	    var vwidth=fdjtDOM.viewWidth();
	    var vheight=fdjtDOM.viewHeight();
	    var height=page.offsetHeight;
	    var width=page.offsetWidth;
	    var gap=vwidth-width;
	    var forced=[]; var pagetops=[];
	    var debug=sbookPaginate.debug;
	    var trace=Codex.Trace.layout;
	    var curpage=-1;
	    var scan=scanContent(content), geom=getGeometry(scan,content), style=getStyle(scan,content);
	    var next=scanContent(scan,style), ngeom=getGeometry(next,content), nstyle=getStyle(next,content);
	    var prev=false, pgeom=false, pstyle=false;
	    fdjtLog("Starting page layout");
	    fdjtTime.timeslice([initLayout,handleDeclaredBreaks,forceBreaks]);
	    /* Here are the parts of the process */
	    function scanStep() {
		var top=geom.top; var bottom=geom.top+geom.height;
		var starts_at=((talldom)?(geom.top/height):(geom.left/vwidth));
		var ends_at=((talldom)?(geom.bottom/height):(geom.right/vwidth));
		var startpage=Math.floor(starts_at), endpage=Math.floor(ends_at);
		var nextpage=((ngeom)&&
			      (Math.floor((talldom)?
					  (ngeom.top/height):
					  (ngeom.left/vwidth))));
		var at_top=((talldom)?(((geom.top/height)%1)<0.001):(geom.top<2));
		var break_after=((next)&&(nextpage>endpage));
		if (at_top) {}
		else if (forceBreakBefore(scan,style)) forceBreak(scan,false);
		else if ((avoidBreakInside(scan,style))&&(endpage>startpage)&&(nextpage>startpage))
		    forceBreak(scan,prev);
		else if ((next)&&(forceBreakAfter(scan,style))) forceBreak(next,prev);
		else if ((break_after)&&(avoidBreakAfter(scan,style))) forceBreak(scan,prev);
		else if ((break_after)&&(avoidBreakBefore(next,nstyle))) forceBreak(scan,prev);
		else {}
		var newpage=Math.floor((talldom)?(geom.top/height):(geom.left/vwidth));
		if (newpage!==curpage) {
		    pagetops[newpage]=scan;
		    curpage=newpage;}
		if (debug)
		    scan.setAttribute(
			"sbookpagedbg",
			_paginationInfo(scan,style,startpage,endpage,nextpage));
		prev=scan; pgeom=geom; pstyle=style;
		geom=ngeom; style=nstyle;
		if (scan=next) next=scanContent(scan,style);
		else next=null;
		if (next) {
		    ngeom=getGeometry(next,content);
		    nstyle=getStyle(next);}}
	    function forceBreaks(){
		var stopblock=fdjtTime()+runslice;
		Codex.Message("Determining page layout");
		while ((scan)&&(fdjtTime()<stopblock)) scanStep();
		if (scan) {
		    chunks++;
		    page_progress(curpage);
		    setTimeout(forceBreaks,runwait);}
		else {
		    finishUp(); chunks++;
		    page_progress(true);
		    if (callback) callback();}}
	    function initLayout(){
		// Clear forced breaks
		if (Codex.forced_breaks) dropClass(Codex.forced_breaks,"codexpagebreak");
		Codex.forced_breaks=[];
		// Set up the column layout
		content.style.maxWidth=content.style.minWidth=(width-20)+"px";
		content.style.marginLeft=content.style.marginRight="10px";
		pages.style.height=height+"px";
		pages.style[fdjtDOM.columnWidth]=width+"px";
		pages.style[fdjtDOM.columnGap]=(vwidth-width)+"px";
		// Figure out whether column layout is expressed in the DOM
		var content_dim=getGeometry(content,pages);
		talldom=(!(content_dim.width>vwidth));}
	    function forceBreak(elt,prev){
		var g=getGeometry(elt,content);
		var oldpage=Math.floor((talldom)?((g.top-booktop)/height):(g.left/vwidth));
		if (hasClass(elt,"codexpagebreak")) return;
		if ((prev)&&((avoidBreakAfter(prev))||(avoidBreakBefore(elt))))
		    addClass(prev,"codexpagebreak");
		else addClass(elt,"codexpagebreak");
		// Some browsers don't recognize columnBreakBefore, so
		// we check that the change actually worked (assuming
		// synchronous DOM updates) and go kludgier if it
		// didn't
		var g=getGeometry(elt,content);
		var newpage=Math.floor((talldom)?((g.top-booktop)/height):(g.left/vwidth));
		if (oldpage===newpage) {
		    // We have to kludge the margin top, and first we
		    // get the geometry without any existing margin
		    elt.style.marginTop='0px';
		    g=getGeometry(elt,content);
		    var top_margin=0;
		    if (talldom) {
			var pageoff=((oldpage+1)*height)+booktop;
			top_margin=(pageoff-g.top);
			if ((trace)&&(typeof trace === 'number')&&(trace>1))
			    fdjtLog("forceBreak/ g=%j height=%o page_height=%o page=%o/%o tm=%o",
				    elt,g,height,newpage,pageoff,top_margin);}
		    else {
			top_margin=height-(g.top-booktop);
		    	if ((trace)&&(typeof trace === 'number')&&(trace>1))
			    fdjtLog("forceBreak/ g=%j height=%o page_height=%o page=%o tm=%o",
				    elt,g,height,newpage,top_margin);}
		    if (top_margin<0) top_margin=0;
		    else top_margin=top_margin%height;
		    elt.style.marginTop=(Math.floor(top_margin))+"px";}
		else if ((trace)&&(typeof trace === 'number')&&(trace>1))
		    fdjtLog("forceBreak g=%j height=%o page_height=%o page=%o",
			    elt,g,height,newpage);
		else {}
		// Update geometries, assuming the DOM is updated synchronously
		if (scan) geom=getGeometry(scan,content);
		if (next) ngeom=getGeometry(next,content);
		if (prev) pgeom=getGeometry(prev,content);
		forced.push(elt);}
	    function handleDeclaredBreaks() {
		var breaks=fdjtDOM.getChildren(content,"sbookpagebreak");
		var i=0; var lim=breaks.length;
		while (i<lim) forceBreak(breaks[i++],false);
		if (sbook_forcebreakbefore) {
		    var breaks=fdjtDOM.getChildren(content,sbook_forcebreakbefore);
		    var i=0; var lim=breaks.length;
		    while (i<lim) forceBreak(breaks[i++],false);}}
	    function finishUp() {
		var content_dim=getGeometry(content,pages);
		var pagecount=Codex.pagecount=
		    ((content_dim.width>vwidth)?
		     (Math.ceil(content_dim.width/vwidth)):
		     (Math.ceil(content_dim.height/height)));
		pages.style.width=pages.style.maxWidth=
		    pages.style.minWidth=(pagecount*vwidth)+"px";
		Codex.page_width=width;
		Codex.page_gap=page_gap=gap;
		Codex.page_height=height;
		Codex.left_margin=page.offsetLeft;
		Codex.top_margin=page.offsetTop;
		Codex.right_margin=vwidth-(page.offsetLeft+page.offsetWidth);
		Codex.bottom_margin=vheight-(page.offsetTop+page.offsetHeight);
		Codex.vwidth=vwidth;
		Codex.vheight=vheight;
		Codex.flip_width=flip_width=gap+
		    getGeometry(Codex.content).width+
		    parsePX(getStyle(Codex.content).marginLeft)+
		    parsePX(getStyle(Codex.content).marginRight);
		Codex.pagetops=pagetops;
		Codex.forced_breaks=forced;}
	    function page_progress(arg){
		var now=fdjtTime();
		if (!(arg)) {}
		else if (typeof arg === 'number') {
		    if ((trace)&&(typeof trace === 'number')&&(trace>1))
			fdjtLog("So far, laid out %d pages in %d chunks and %f seconds",arg,
				chunks,fdjtTime.secs2short((now-start_time)/1000));}
		else fdjtLog("Done laying out %d pages over %d chunks in %f seconds (rt~%f)",
			     Codex.pagecount,chunks,
			     fdjtTime.secs2short((now-start_time)/1000),
			     fdjtTime.secs2short(chunks*(1/runslice)));}}
	
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
	    if ((next)&&(sbookPaginate.debug)) {
		if (next.id) scan.setAttribute("sbooknextnode",next.id);
		if (scan.id) next.setAttribute("sbookprevnode",scan.id);}
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

	function _paginationInfo(elt,style,startpage,endpage,nextpage){
	    var info=getGeometry(elt,Codex.content);
	    return elt.id+"/t"+(elt.toclevel||0)+
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
		"]";}

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
	    if (talldom) off=(num*(flip_width));
	    else {
		var top=Codex.pagetops[num];
		var geom=fdjtDOM.getGeometry(top,Codex.content);
		var pageleft=geom.left-getCSSLeft(top,Codex.content);
		off=pageleft;}
	    if (Codex.Trace.nav)
		fdjtLog("GoToPage%s %o",((caller)?"/"+caller:""),pageno);
	    Codex.pages.style.setProperty(
		fdjtDOM.transform,
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
		Codex.setState(
		    {page: pageno,location: info.loc,
		     target:((Codex.target)&&(Codex.target.id))});}
	Codex.GoToPage=GoToPage;
	Codex.FadeToPage=GoToPage;
	
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
	    if (Codex.preview) return false;
	    if (Codex.pagecount)
		Codex.GoToPage(Codex.curpage,"displaySync");}
	Codex.displaySync=displaySync;

	/* External refs */
	sbookPaginate.forceBreakBefore=forceBreakBefore;
	sbookPaginate.avoidBreakInside=avoidBreakInside;
	sbookPaginate.forceBreakAfter=forceBreakAfter;
	sbookPaginate.avoidBreakAfter=avoidBreakAfter;
	sbookPaginate.avoidBreakBefore=avoidBreakBefore;
	sbookPaginate.isContentBlock=isContentBlock;
	sbookPaginate.scanContent=scanContent;
	sbookPaginate.debug=debug_pagination;
	
	/* Margin creation */

	function initDisplay(){
	    var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
	    var bottomleading=fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
	    topleading.sbookui=true; bottomleading.sbookui=true;

	    var pagehead=fdjtDOM("div.sbookmargin#SBOOKPAGEHEAD"," ");
	    var pageinfo=
		fdjtDOM("div#CODEXPAGEINFO",
			fdjtDOM("div.progressbar#CODEXPROGRESSBAR",""),
			fdjtDOM("div#CODEXPAGENO",
				fdjtDOM("span#CODEXPAGENOTEXT","p/n")));
	    var pagefoot=fdjtDOM(
		"div.sbookmargin#SBOOKPAGEFOOT",
		pageinfo," ",
	    	fdjtDOM.Image("http://static.beingmeta.com/graphics/PageNext50x50.png",
			      "img#CODEXPAGENEXT.hudbutton.bottomright",
			      "pagenext","go to the next result/section/page"));
	    pagehead.sbookui=true; pagefoot.sbookui=true;
	    sbookPageHead=pagehead; sbookPageFoot=pagefoot;

	    fdjtDOM.addListeners(
		pageinfo,Codex.UI.handlers[Codex.ui]["#CODEXPAGEINFO"]);

	    fdjtDOM.prepend(document.body,pagehead,pagefoot);
	    
	    if (Codex.nativescroll) {
		fdjtDOM.prepend(document.body,topleading);
		fdjtDOM.append(document.body,bottomleading);}
	    else {}
	    
	    fdjtID("CODEXPAGENEXT").onclick=Codex.Forward;

	    if (!(Codex.nativescroll)) window.scrollTo(0,0);

	    // The better way to do this might be to change the stylesheet,
	    //  but fdjtDOM doesn't currently handle that 
	    var bgcolor=getBGColor(document.body)||"white";
	    if (bgcolor==='transparent')
		bgcolor=fdjtDOM.getStyle(document.body).backgroundColor;
	    if ((bgcolor)&&(bgcolor.search("rgba")>=0)) {
		if (bgcolor.search(/,\s*0\s*\)/)>0) bgcolor='white';
		else {
		    bgcolor=bgcolor.replace("rgba","rgb");
		    bgcolor=bgcolor.replace(/,\s*((\d+)|(\d+.\d+))\s*\)/,")");}}
	    else if (bgcolor==="transparent") bgcolor="white";
	    pagehead.style.backgroundColor=bgcolor;
	    pagefoot.style.backgroundColor=bgcolor;
	    fdjtDOM.addListener(false,"resize",resizePage);}
	Codex.initDisplay=initDisplay;
	
	function getBGColor(arg){
	    var color=fdjtDOM.getStyle(arg).backgroundColor;
	    if (!(color)) return false;
	    else if (color==="transparent") return false;
	    else if (color.search(/rgba/)>=0) return false;
	    else return color;}

	/* Updates */

	function resizePage(){
	    var vw=fdjtDOM.viewWidth();
	    var vh=fdjtDOM.viewHeight();
	    if (!(Codex.nativescroll)) {
		window.scrollTo(0,0);
		document.body.style.width=vw+'px';
		document.body.style.height=vh+'px';}
	    setTimeout(sbookUpdatePagination,100);}

	/* Top level functions */

	function sbookUpdatePagination(callback){
	    var target=Codex.target;
	    Codex.Message("Determining page layout");
	    var body=Codex.body||document.body;
	    fdjtDOM.addClass(document.body,"sbookpaginated");
	    clearPagination();
	    Paginate(callback);}

	function sbookPaginate(flag,nogo){
	    if (flag===false) {
		if (Codex.paginate) {
		    Codex.paginate=false;
		    sbook_nextpage=false; sbook_pagebreak=false;
		    fdjtDOM.dropClass(document.body,"sbookpaginated");
		    fdjtDOM.addClass(document.body,"sbookscrolling");
		    if (!(nogo)) {
			var curx=fdjtDOM.viewLeft(); var cury=Codex.viewTop();
			Codex.scrollTo(0,0);
			Codex.scrollTo(curx,cury);}
		    return;}
		else return;}
	    else {
		Codex.paginate=true;
		fdjtDOM.addClass(document.body,"sbookpaginated");}
	    if ((sbook_paginated)&&
		(sbook_paginated.offheight===document.body.offsetHeight)&&
		(sbook_paginated.offwidth===document.body.offsetWidth)&&
		(sbook_paginated.winwidth===
		 (document.documentElement.clientWidth))&&
		(sbook_paginated.winheight===(fdjtDOM.viewHeight()))) {
		return false;}
	    else repaginate();}
	
	function repaginate(){
	    var newinfo={};
	    var computePages=function(){
		sbookUpdatePagination(function(result){
		    newinfo.offheight=document.body.offsetHeight;
		    newinfo.offwidth=document.body.offsetWidth;
		    newinfo.winwidth=(document.documentElement.clientWidth);
		    newinfo.winheight=(fdjtDOM.viewHeight());
		    sbook_paginated=newinfo;
		    var gotopage=Codex.getPageAt(Codex.location);
		    Codex.GoToPage(gotopage||0,"sbookUpdatePagination",true);})};
	    adjustFullPages(computePages);}
	
	// fdjtDOM.trace_adjust=true;

	return sbookPaginate;})();

/* Pagination utility functions */

Codex.setFontSize=function(size){
    if (Codex.body.style.fontSize!==size) {
	Codex.body.style.fontSize=size;
	sbookPaginate();}};

Codex.setUIFontSize=function(size){
    if (CodexHUD.style.fontSize!==size) CodexHUD.style.fontSize=size;};

fdjt_versions.decl("codex",codex_pagination_version);
fdjt_versions.decl("codex/pagination",codex_pagination_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
