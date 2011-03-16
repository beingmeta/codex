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
	var sbook_pages=[];
	var sbook_pageinfo=[];
	var sbook_pagemaxoff=-1;
	var sbook_pagescroll=false;
	var sbook_fudge_bottom=false;
	
	var sbookPageHead=false;
	var sbookPageFoot=false;
	
	var pretweak_page_breaks=true;

	var sbook_edge_taps=true;

	var sbook_avoidpagebreak=false;
	var sbook_forcepagehead=false;
	var sbook_forcepagefoot=false;
	var sbook_avoidpagefoot=false;
	var sbook_avoidpagehead=false;
	var sbook_pageblock=false;
	var sbook_fullpages=false;

	var isEmpty=fdjtString.isEmpty;
	var getGeometry=fdjtDOM.getGeometry;
	var getStyle=fdjtDOM.getStyle;
	var parsePX=fdjtDOM.parsePX;

	var sbook_body=false;
	var pagewidth=false;
	var pageheight=false;
	
	sbook.pageTop=function(){return sbook_top_px;}
	sbook.pageBottom=function(){return sbook_bottom_px;}
	sbook.pageLeft=function(){return sbook_left_px;}
	sbook.pageRight=function(){return sbook_right_px;}
	sbook.pageSize=function(){return sbook.page.offsetHeight;}

	function readSettings(){
	    sbook_avoidpagebreak=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookavoidbreak",true));
	    sbook_pageblock=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookpageblock",true));
	    sbook_forcepagehead=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookpagehead",true));
	    sbook_forcepagefoot=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookpagefoot",true));
	    sbook_avoidpagefoot=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookavoidfoot",true));
	    sbook_avoidpagehead=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookavoidhead",true));
	    sbook_fullpages=
		fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));}
	sbookPaginate.readSettings=readSettings;
	sbookPaginate.getSettings=function(){
	    var result= {};
	    if (sbook_avoidpagebreak)
		result["sbook_avoidpagebreak"]=sbook_avoidpagebreak;
	    if (sbook_pageblock)
		result["sbook_pageblock"]=sbook_pageblock;
	    if (sbook_forcepagehead)
		result["sbook_forcepagehead"]=sbook_forcepagehead;
	    if (sbook_forcepagefoot)
		result["sbook_forcepagefoot"]=sbook_forcepagefoot;
	    if (sbook_avoidpagefoot)
		result["sbook_avoidpagefoot"]=sbook_avoidpagefoot;
	    if (sbook_avoidpagehead)
		result["sbook_avoidpagehead"]=sbook_avoidpagehead;
	    if (sbook_fullpages)
		result["sbook_fullpages"]=sbook_fullpages;
	    return result;}

	/* Adjust full pages */

	function adjustFullPages(alldone){
	    var fullpages=fdjtDOM.$(".sbookfullpage");
	    if (sbook_fullpages)
		fullpages=fullpages.concat(fdjtDOM.$(sbook_fullpages));
	    var i=0; var lim=fullpages.length;
	    while (i<lim) {
		var block=fullpages[i++];
		var blockstyle=getStyle(block);
		block.style.maxHeight=pageheight+'px';
		block.style.maxWidth=pagewidth+'px';}
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
			if (false) { // (!(sbook.colpage))
			    var bwidth=block.offsetWidth;
			    var bheight=block.offsetHeight;
			    scaleby=Math.min(pwidth/bwidth,pheight/bheight);
			    block.style[fdjtDOM.transform]="scale("+scaleby+")";
			    block.style.transform="scale("+scaleby+")";}
			// block.style.width=(pwidth*(1/scaleby))+'px';
			// block.style.height=(pheight*(1/scaleby))+'px';
		    }
		document.body.className=document.body.className;
		if (sbook.colpage) {
		    var content=fdjtID("CODEXCANVAS");
		    sbook.pagecount=
			Math.floor(content.scrollWidth/fdjtDOM.viewWidth());};};
	    fdjtTime.timeslice
	    ([adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
	      adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
	      finish_scaling,finalizepages,alldone],
	     0,100);}

	/* Updating the page display */

	function updatePageDisplay(info,pagenum,pageoff) {
	    var npages=sbook.pages.length;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=sbook.ends_at;
	    var starts_at=info.loc;
	    var ends_at=((sbook.pageinfo[pagenum+1])?
			 (sbook.pageinfo[pagenum+1].loc):
			 (book_len));
	    pbar.style.left=(100*(starts_at/book_len))+"%";
	    pbar.style.width=((100*(ends_at-starts_at))/book_len)+"%";
	    var locoff=fdjtDOM("span.locoff#CODEXLOCOFF",
			       "L"+Math.ceil(info.loc/128));
	    var pageno_text=
		fdjtDOM("span#CODEXPAGENOTEXT.pageno",
			pagenum+1,((pageoff)?"+":""),"/",npages);
	    var pageno=fdjtDOM("div#CODEXPAGENO",locoff,pageno_text);
	    fdjtDOM.replace("CODEXPAGENO",pageno);
	    fdjtDOM.replace("CODEXPROGRESSBAR",pbar);
	    locoff.title="click to jump to a particular location";
	    fdjtDOM.addListeners
	      (locoff,sbook.UI.handlers[sbook.ui]["#CODEXLOCOFF"]);
	    pageno_text.title="click to jump to a particular page";
	    fdjtDOM.addListeners
	      (pageno_text,sbook.UI.handlers[sbook.ui]["#CODEXPAGENOTEXT"]);}

	/* Column pagination */

	// These are experiments with Monocle style column pagination
	//  which we're not currently using because the treatment of
	//  column-breaks is not handled very well.

	var colgap;

	function SetupColumnPaginate(){
	    var body=document.body;
	    var page=fdjtID("CODEXPAGE");
	    var canvas=fdjtID("CODEXCANVAS");
	    var content=fdjtID("SBOOKCONTENT");
	    var pbounds=fdjtDOM.getGeometry(page);
	    var cbounds=fdjtDOM.getGeometry(content);
	    var vh=fdjtDOM.viewHeight();
	    var width=pagewidth=sbook.pagewidth=cbounds.width;
	    var gap=colgap=sbook.colgap=pbounds.width-width;
	    var style=content.style;
	    fdjtDOM.dropClass(body,"sbookpagevertical");
	    fdjtDOM.addClass(body,"sbookpagehorizontal");
	    fdjtDOM.addClass(body,"sbookpaginated");
	    window.scrollTo(0,0);
	    style[fdjtDOM.columnWidth||"column-width"]=width+'px';
	    style[fdjtDOM.columnGap||"column-gap"]=gap+'px';
	    sbook.pageheight=pageheight=pbounds.height;
	    style.height=pageheight+'px';}

	function ColumnGoToPage(pageno,offset,caller,nosave){
	    var hoff=(pagewidth+colgap)*pageno;
	    var info=sbook.pageinfo[pageno];
	    if (sbook.Trace.nav)
		fdjtLog("ColumnGoToPage%s %o, hoff=%o",
			((caller)?"/"+caller:""),pageno,hoff);
	    fdjtID("CODEXCANVAS").style[fdjtDOM.transform]=
		"translate(-"+hoff+"px,0px)";
	    updatePageDisplay(info,pageno,0);
	    sbook.curpage=pageno;
	    if (!(nosave))
		sbook.setState(
		    {page: pageno,location: info.loc,
		     target:((sbook.target)&&(sbook.target.id))});}

	/* Scroll paginate */

	function Paginate(pagesize,start,callback){
	    var getLocInfo=sbook.getLocInfo;
	    if (!(sbook_body)) sbook_body=sbook.body;
	    if (!(start)) start=sbook.body||document.body;
	    start=scanContent(start);
	    if (sbook.Trace.layout)
		fdjtLog("Starting pagination at %o",start);
	    var debug=sbookPaginate.debug;
	    var result={}; var pages=[]; var pageinfo=[];
	    result.pages=pages; result.info=pageinfo;
	    var scan=start; var info=nodeInfo(scan); var style=getStyle(scan);
	    var last=false; var last_info=false; var last_style=false;
	    var pagetop=info.top; var pagelim=pagetop+pagesize;
	    var startedat=fdjtET();
	    var curpage={}; var newtop=false; var nodecount=1;
	    curpage.loc=0;
	    curpage.pagenum=pages.length;
	    curpage.top=pagetop; curpage.limit=pagelim;
	    curpage.first=start; curpage.last=start;
	    pages.push(pagetop); pageinfo.push(curpage);
	    function loop() {
		var oversize=false;
		var next=scanContent(scan);
		var nextinfo=(next)&&nodeInfo(next);
		var splitblock=false; var forcebottom=false;
		var widowthresh=((info.fontsize)*sbook_widow_limit);
		var orphanthresh=((info.fontsize)*sbook_orphan_limit);
		// If the top of the current node is above the page,
		//  make scantop be the page top
		var scantop=((info.top<pagetop)?(pagetop):(info.top));
		var dbginfo=((debug)&&
			     ("P#"+(curpage.pagenum+1)+
			      "["+pagetop+","+pagelim+
			      "/"+pagesize+"/"+widowthresh+","+orphanthresh+"] "));
		// We track a 'focus' for every page, which is the first sbook
		// focusable element on the page.
		if (!(curpage.focus))
		    if ((scan.toclevel)||
			((sbook.focusrules)&&(sbook.focusrules.match(scan))))
			curpage.focus=scan;
		if (dbginfo) dbginfo=dbginfo+(pageNodeInfo(scan,info,curpage));
		if ((dbginfo)&&(next))
		    dbginfo=dbginfo+" ... N#"+next.id+
		    pageNodeInfo(next,nextinfo,curpage);
		if (sbook.Trace.layout>1)
		    _sbookTracePagination("SCAN",scan,info);
		if ((dbginfo)&&(scan.getAttribute("sbookpagedbg")))
		    dbginfo=scan.getAttribute("sbookpagedbg")+" // "+dbginfo;
		if (isPageHead(scan,style)) {
		    // Unless we're already at the top, just break
		    if (scantop>pagetop) newtop=scan;
		    else {}}
		// WE'RE COMPLETELY OFF THE PAGE
		else if (scantop>pagelim) {
		    // Issue a warning (if neccessary) and break on this element
		    if (avoidPageHead(scan,style)) 
			fdjtLog.warn(
			    "Pagination got stuck with non page head %o",
			    scan);
		    else if (isPageFoot(scan,style))
			fdjtLog.warn(
			    "Pagination got stuck with page foot at head %o",
			    scan);
		    else {}
		    newtop=scan;}
		else if ((info.bottom>pagelim)&&(isPageBlock(scan,style))) {
		    if (info.top>pagetop)  // If we're not at the top, break now
			newtop=scan;
		    else {
			// Otherwise, declare an oversized page
			curpage.bottom=info.bottom;
			curpage.oversize=oversize=true;}}
		// WE'RE COMPLETELY ON THE PAGE
		// including the case where we have children which are
		// on the page.
		else if ((info.bottom<pagelim)||
			 ((nextinfo)&&(nextinfo.top<pagelim))) {
		    if (avoidPageHead(scan,style)) {
			/* don't think about breaking here */}
		    // if we want to be a foot, force a break at the next node
		    else if (isPageFoot(scan)) {
			curpage.bottom=info.bottom;
			newtop=scanContent(scan);}
		    // if we're a bad foot close to the bottom, break
		    else if (((scan.toclevel)||(avoidPageFoot(scan,style)))&&
			     ((pagelim-info.bottom)<widowthresh))
			newtop=scan;
		    // Look ahead to see if we should page break anyway
		    else if (next) {
			var nextstyle=getStyle(next);
			// Only record next in debug info if we look at it
			if (dbginfo)
			    dbginfo=dbginfo+" ... N#"+next.id+
			    pageNodeInfo(next,nextinfo,curpage);
			// If we're trying to avoid putting this item
			// at the foot
			if ((scan.toclevel)||(avoidPageFoot(scan,style))) {
			    // Break here if the next item 
			    if ((nextinfo.top>=pagelim) // is off the page
				// is a forced head
				||(isPageHead(next,nextstyle))
				// is a straddling no-break block
				||((nextinfo.top<pagelim)&&
				   (nextinfo.bottom>pagelim)&&
				   (isPageBlock(next,nextstyle)))
				// is a bad foot close to the bottom
				||(((next.toclevel)||
				    (avoidPageFoot(next,nextstyle)))&&
				   ((pagelim-nextinfo.bottom)<widowthresh*2))
				// is likely to be pushed off the bottom
				||((pagelim-nextinfo.top)<widowthresh)
				// is small and straddling
				||((nextinfo.bottom>=pagelim)&&
				   ((nextinfo.height)<(widowthresh+orphanthresh))))
				newtop=scan;
			    else {}} ///// End of foot avoiding logic
			else if (avoidPageHead(next,nextstyle)) {
			    // If the next node is a bad head, break or split
			    // if there is enough space for it, just continue
			    if (nextinfo.bottom<pagelim) {}
			    else { // Otherwise, either break or split
				// newbreak is where the new break would be
				var newbreak=info.bottom-orphanthresh;
				// If it would create widows or be
				// offpage entirely, split the difference
				if (newbreak<(scantop+widowthresh)) {
				    newtop=splitblock=scan;
				    curpage.bottom=
					info.top+Math.floor(info.height/2);}
				else {
				    // otherwise, split the current block to keep
				    // the next element from being a pagehead
				    curpage.bottom=newbreak;
				    newtop=splitblock=scan;}
				if (sbook.Trace.layout) 
				    fdjtLog("pre-emptive split of %o: nb=%o cb=%o st=%o wt=%o",
					    scan,newbreak,curpage.bottom,
					    scantop,widowthresh);}}
			// No problem, leave this block on the page
			else {}}
		    // We're on the page and at the end
		    else {}
		    /* End of 'on the page' cases */}
		// If we've gotten here,
		// WE'RE STRADDLING THE BOTTOM OF THE PAGE
		else if (isPageBlock(scan,style)) {
		    if (curpage.top<scantop)
			// Break if we're not at the top already
			newtop=scan;
		    else {
			// If we're already at the top, this is a huge block
			// and we will make an oversize page
			curpage.bottom=info.bottom;
			curpage.oversize=oversize=true;
			curpage.last=scan;}}
		else if ((scan.toclevel)||(avoidPageFoot(scan,style)))
		    // If we're avoiding the foot, we start a new page
		    newtop=scan;
		else if (avoidPageHead(scan,style)) {
		    // If we're avoiding the head, we split this block.
		    newtop=splitblock=scan;
		    curpage.bottom=pagelim;}
		// If we're too small to split, just start a new page
		else if (info.height<(widowthresh+orphanthresh))
		    newtop=scan;
		// If splitting would create a widow, just break
		else if ((pagelim-scantop)<widowthresh)
		    newtop=scan;
		// If we might create orphans, adjust the page bottom
		// to ensure that doesn't happen
		else if ((info.bottom-pagelim)<orphanthresh) {
		    // Or making this page shorter to keep orphans from being
		    // too isolated on the next page
		    // move the pagelim up to make sure the orphans aren't isolated
		    curpage.bottom=pagelim=info.bottom-orphanthresh;
		    newtop=splitblock=scan;}
		//  If the next node is inside the current one, just break
		else if (fdjtDOM.hasParent(next,scan))
		    newtop=scan;
		else {
		    // Just break at (around) the pagelim
		    newtop=splitblock=scan;
		    curpage.bottom=pagelim;}
		
		// Okay, we've figured out what to do with this element
		if (!(newtop)) {
		    // When we're not starting a new page, just extend the bottom
		    //  of this one
		    curpage.bottom=info.bottom;
		    curpage.last=scan;}
		else {
		    // If we starting a new page, clean up the page break
		    var newinfo=((newtop==scan)?(info):nodeInfo(newtop));
		    var prevpage=curpage;
		    if ((sbook.colpage)&&(!(splitblock)))
			fdjtDOM.addClass(newtop,"sbookcolbreak");
		    if (dbginfo)
			dbginfo=dbginfo+" np"+((splitblock)?"/split":"")+"/"+curpage.bottom;
		    // Adjust the page bottom information
		    if (splitblock) {
			// curpage.bottom=pagelim;
			curpage.last=splitblock;
			if (!(sbook.colpage)) {
			    var newbottom=
				((sbook.fastpage)?(curpage.bottom):
				 (AdjustPageBreak(splitblock,curpage.top,curpage.bottom)));
			    if ((newbottom>pagetop)&&(newbottom>info.top)&&
				 (newbottom>(pagetop+(pagesize/2)))) {
				// Check that we were able to find a
				// good page break
				curpage.bottom=newbottom;
				curpage.bottomedge=splitblock;
				if (dbginfo) dbginfo=dbginfo+"~"+curpage.bottom;
				// If we're splitting, force the next
				// node to be the split block
				next=splitblock; nextinfo=info;}
			    else {
				curpage.bottom=newbottom;
				curpage.bottomedge=splitblock;
				if (dbginfo)
				    dbginfo=dbginfo+"~!"+curpage.bottom;}}}
		    // If it's a clean break, make sure that the page
		    // bottom is good
		    else if (!(last)) {
			// curpage.bottom=newinfo.top-1;
		    }
		    else {
			var mbottom=parsePX(last_style.marginBottomWidth);
			curpage.bottom=last_info.top+last_info.height-mbottom;}
		    if (sbook.Trace.layout) 
			fdjtLog("New %spage break P%d[%d,%d]#%s %o, closed P%d[%d,%d] %o",
				((splitblock)?("split "):("")),
				pages.length,newinfo.top,newinfo.bottom,newtop.id,newtop,
				curpage.pagenum,curpage.top,curpage.bottom,curpage);
		    // Make a new page
		    curpage={}; curpage.pagenum=pages.length;
		    // Returns start and end location
		    if (splitblock) {
			var locinfo=getLocInfo(splitblock);
			curpage.top=prevpage.bottom;
			if (locinfo)  {
			    var height=newinfo.height;
			    var above=curpage.top-newinfo.top;
			    curpage.loc=
				(locinfo.start)+
				Math.round(locinfo.len*(above/height));}}
		    else {
			var locinfo=getLocInfo(newtop);
			if (locinfo) curpage.loc=locinfo.start;
			curpage.top=newinfo.top;}
		    // Initialize the first and last elements on the page
		    curpage.first=newtop; curpage.last=newtop;
		    // Indicate the straddling top element, if we're split
		    if (splitblock) curpage.topedge=splitblock;
		    // Initialize the scan variables of the page top and bottom
		    pagetop=curpage.top;
		    pagelim=curpage.limit=pagetop+pagesize;
		    last=scan; last_info=info; last_style=style;
		    scan=newtop; if (scan) style=getStyle(scan);
		    splitblock=false; newtop=false;
		    // Update the tables
		    pages.push(pagetop); pageinfo.push(curpage);}
		if (dbginfo) scan.setAttribute("sbookpagedbg",dbginfo);
		// Advance around the loop.  If we have an explicit next page,
		//  we use it (usually the case if we're splitting a block).
		if (oversize) {
		    last=scan; last_info=info; last_style=style;
		    scan=scanContent(scan,true);
		    if (scan) style=getStyle(scan);
		    if (scan) info=nodeInfo(scan);}
		else if (next) {
		    last=scan; last_info=info; last_style=style;
		    scan=next;
		    if (scan) style=getStyle(scan);
		    info=nextinfo;}
		else {
		    // Otherwise, advance through the DOM
		    last=scan; last_info=info; last_style=style;
		    scan=scanContent(scan);
		    if (scan) info=nodeInfo(scan);
		    if (scan) style=getStyle(scan);}
		if (!(splitblock)) nodecount++;}
	    var count=1;
	    function stepfn(){
		var stopblock=fdjtTime()+200;
		while ((scan)&&(fdjtTime()<stopblock)) loop();
		if (scan) {
		    sbook.Message(
			"Determining page layout",pageinfo.length," pages");
		    setTimeout(stepfn,200);}
		else {
		    var doneat=fdjtET();
		    if ((sbook.Trace.layout)||
			((sbook.Trace.startup)&&(!(sbook._setup))))
			fdjtLog("Paginated %d nodes into %d pages with pagesize=%d in %s",
				nodecount,pages.length,pagesize,
				fdjtTime.secs2short(doneat-startedat));
		    callback(result);}}
	    setTimeout(stepfn,10);}
	
	function isPageHead(elt,style){
	    if ((sbook_tocmajor)&&(elt.id)&&
		    ((sbook.docinfo[elt.id]).toclevel)&&
		    (((sbook.docinfo[elt.id]).toclevel)<=sbook_tocmajor))
		return true;
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakBefore==='always')||
		((sbook_forcepagehead)&&(sbook_forcepagehead.match(elt)));}

	function isPageFoot(elt,style){ 
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakAfter==='always')||
		((sbook_forcepagefoot)&&(sbook_forcepagefoot.match(elt)));}

	// We explicitly check for these classes because some browsers
	//  which should know better (we're looking at you, Firefox) don't
	//  represent (or handle) page-break 'avoid' values.  Sigh.
	var page_break_classes=
	    /(\bfullpage\b)|(\btitlepage\b)|(\bsbookfullpage\b)|(\bsbooktitlepage\b)/;
	function isPageBlock(elt,style){
	    if (!(elt)) return false;
	    if (elt.tagName==='IMG') return true;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakInside==='avoid')||
		(elt.className.search(page_break_classes)>=0)||
		((sbook_avoidpagebreak)&&(sbook_avoidpagebreak.match(elt)));}

	function avoidPageHead(elt,style){
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return ((style.pageBreakBefore==='avoid')||
		    ((sbook_avoidpagehead)&&(sbook_avoidpagehead.match(elt))));}

	function avoidPageFoot(elt,style){
	    if (!(elt)) return false;
	    if ((elt.id)&&(sbook.docinfo[elt.id])&&
		((sbook.docinfo[elt.id]).toclevel))
		return true;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakAfter==='avoid')||
		((sbook_avoidpagefoot)&&(sbook_avoidpagefoot.match(elt)));}

	function nodeInfo(node,style){
	    var info=getGeometry(node,sbook_body);
	    var fontsize=((style)||getStyle(node)).fontSize;
	    if ((fontsize)&&(typeof fontsize === 'string'))
		fontsize=parseInt(fontsize.slice(0,fontsize.length-2));
	    info.fontsize=(fontsize||12);
	    return info;}

	var sbook_content_nodes=['IMG','BR','HR'];
	
	function scanContent(scan,skipchildren){
	    var next=(((skipchildren)||(scan.sbookui)||(isPageBlock(scan)))?
		      (fdjtDOM.next(scan,isContentBlock)):
		      (fdjtDOM.forward(scan,isContentBlock)));
	    var info=getGeometry(scan,sbook_body);
	    var nextinfo=((next)&&(getGeometry(next,sbook_body)));
	    if (!(next)) {}
	    else if ((nextinfo.height===0)||(nextinfo.top<info.top)) 
		// Skip over weird nodes
		return scanContent(next,skipchildren);
	    else if ((isPageHead(next))||(isPageBlock(next))) {}
	    else if ((sbook.colpage)&&(isWrapped(next)))
		return next;
	    else if ((next.childNodes)&&(next.childNodes.length>0)) {
		var children=next.childNodes;
		if ((children[0].nodeType===1)&&(isContentBlock(children[0])))
		    next=children[0];
		else if ((children[0].nodeType===3)&&
			 (isEmpty(children[0].nodeValue))&&
			 (children.length>1)&&(children[1].nodeType===1)&&
			 (isContentBlock(children[1])))
		    next=children[1];}
	    if ((next)&&(sbookPaginate.debug)) {
		if (next.id) scan.setAttribute("sbooknextnode",next.id);
		if (scan.id) next.setAttribute("sbookprevnode",scan.id);}
	    return next;}
	sbook.scanContent=scanContent;

	function isWrapped(node){
	    var style=getStyle(node);
	    return
	    (((style.paddingLeft)&&fdjtDOM.parsePX(style.paddingLeft))||
	     ((style.borderLeft)&&fdjtDOM.parsePX(style.borderLeft))||
	     ((style.marginLeft)&&fdjtDOM.parsePX(style.marginLeft))||
	     (((style.paddingRight)&&fdjtDOM.parsePX(style.paddingRight)))||
	     ((style.borderRight)&&fdjtDOM.parsePX(style.borderRight))||
	     ((style.marginRight)&&fdjtDOM.parsePX(style.marginRight)));}
	     
	
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
	
	function isJustContainer(node,style){
	    var children=node.childNodes;
	    var i=0; var len=children.length;
	    while (i<len) {
		var child=children[i++];
		if ((child.nodeType===3)&&
		    (!(isEmpty(child.nodeValue))))
		    return false;
		else if (child.sbookui) {}
		else if (sbook_block_tags[node.tagName]) {}
		else if (styleinfo=((style)||getStyle(node))) {
		    if (styleinfo.position!=='static') {}
		    else if ((styleinfo.display==='block')||
			     (styleinfo.display==='list-item'))
		    {}
		    else return false;}
		else {}}
	    return true;}

	function isContainer(node){
	    var next=scanContent(node);
	    if (fdjtDOM.hasParent(next,node)) return next;
	    else return false;}


	function _sbookTracePagination(name,elt,info){
	    if (elt)
		fdjtLog("%s '%s' [%d,%d] %d%s%s%s%s%s %o",
			name,elt.id,info.top,info.bottom,
			elt.toclevel||0,
			((isPageHead(elt))?"/ph":""),
			((isPageBlock(elt))?"/pb":""),
			((avoidPageHead(elt))?"/ah":""),
			((avoidPageFoot(elt))?"/af":""),
			((fdjtDOM.hasText(elt))?"/ht":""),
			elt);
	    else fdjtLog("%s none",name);}

	function _sbookPaginationInfo(elt,info,newpage,splitblock){
	    return ((splitblock)?"s":(newpage)?"h":"p")+(elt.toclevel||0)+
		((isPageHead(elt))?"/ph":"")+
		((isPageBlock(elt))?"/pb":"")+
		((avoidPageHead(elt))?"/ah":"")+
		((avoidPageFoot(elt))?"/af":"")+
		((fdjtDOM.hasText(elt))?"/ht":"")+
		" ["+
		info.top+","+info.bottom+"-"+info.height+
		((info.fontsize)?"/":"")+((info.fontsize)?(info.fontsize):"")+
		+"]"+
		((newpage)?((newpage!==elt)?("ph="+newpage.id):""):"");}

	function pageNodeInfo(elt,info,curpage){
	    return "["+info.top+","+info.bottom+"/"+info.height+"] "+
		(((info.top<=curpage.top)&&(info.bottom>=curpage.limit))?"around":
		 ((info.top>curpage.top)&&(info.bottom<curpage.limit))?"inside":
		 ((info.top<curpage.top)&&(info.bottom>=curpage.top))?"topedge":
		 ((info.top<curpage.limit)&&(info.bottom>=curpage.limit))?"botedge":
		 (info.top>=curpage.limit)?"below":
		 (info.bottom<=curpage.top)?"above":
		 "weird")+
		"/t"+(elt.toclevel||0)+
		((isPageHead(elt))?"/ph":"")+
		((isPageBlock(elt))?"/pb":"")+
		((avoidPageHead(elt))?"/ah":"")+
		((avoidPageFoot(elt))?"/af":"")+
		((fdjtDOM.hasText(elt))?"/ht":"");}

	/* Adjusting pages */
	
	/* This adjusts the offset of a page and its successor to
	 * avoid widows */
	
	function AdjustPageBreak(node,top,bottom,style){
	    var nodeinfo=getGeometry(node,sbook_body);
	    var styleinfo=((style)||getStyle(node));
	    var lastbottom=nodeinfo.top;
	    var linebottom=lastbottom;
	    var children=node.childNodes;
	    var len=children.length; 
	    if (sbook.Trace.layout)
		fdjtLog("Adjusting split block %o at bottom of [%d,%d]",
			node,top,bottom);
	    var i=0; while (i<len) {
		var child=children[i++];
		if (child.nodeType===1) {
		    if (child.sbookinui) continue;
		    else {
			var offinfo=getGeometry(child,sbook_body);
			if ((!(offinfo))||(offinfo.height===0)) continue;
			else if (offinfo.bottom<top) continue;
			else if (offinfo.bottom>=bottom) {
			    fdjtDOM.addClass(child,"sbookpagesplit");
			    if (sbook.Trace.layout)
				fdjtLog("Splitting %o at %o",node,child);
			    return lastbottom;}
			else if (offinfo.top>=lastbottom) { // new line 
			    lastbottom=linebottom;
			    linebottom=offinfo.bottom;}
			else if (offinfo.bottom>linebottom)
			    linebottom=offinfo.bottom;
			else {}}}
		else if (child.nodeType===3) {
		    // Make the text into a span
		    var chunk=fdjtDOM("span",child.nodeValue);
		    node.replaceChild(chunk,child);
		    var offinfo=getGeometry(chunk,sbook_body);
		    if ((!(offinfo))||(offinfo.height===0)) {
			node.replaceChild(child,chunk);
			continue;}
		    else if (offinfo.bottom<top) {
			node.replaceChild(child,chunk);
			continue;}
		    else if (offinfo.top>=bottom) {
			// if it's over the bottom, put it back
			// and use the last valid bottom
			fdjtDOM.addClass(chunk,"sbookpagesplit");
			if (sbook.Trace.layout)
			    fdjtLog("Splitting %o at %o",node,chunk);
			// node.replaceChild(child,chunk);
			return lastbottom;}
		    else if (offinfo.bottom<bottom) {
			// if it's above the bottom, put it back and keep going
			node.replaceChild(child,chunk);
			if (offinfo.top>=lastbottom) { // new line 
			    lastbottom=linebottom;
			    linebottom=offinfo.bottom;}
			else if (offinfo.bottom>linebottom)
			    linebottom=offinfo.bottom;
			else {}}
		    else {
			// It's stradding the bottom, so we go finer
			var split=sbookSplitNode(child);
			node.replaceChild(split,chunk);
			var words=split.childNodes;
			var j=0; var nwords=words.length;
			while (j<nwords) {
			    var word=words[j++];
			    if (word.nodeType!==1) continue;
			    var wordoff=getGeometry(word,sbook_body);
			    if (wordoff.bottom<top) continue;
			    else if (wordoff.bottom>=bottom) {
				// As soon as we're over the bottom,
				// we return the last bottom
				var before=""; var after="";
				var k=0; j--; while (k<j) {
				    var wd=words[k++];
				    before=before+(wd.textValue||wd.nodeValue);}
				k++;
				while (k<nwords) {
				    var wd=words[k++];
				    after=after+(wd.textValue||wd.nodeValue);}
				var splitnode=
				    fdjtDOM("span.sbookpagesplit",
					    (word.nodeValue||word.textValue));
				if (sbook.Trace.layout)
				    fdjtLog("Splitting %o at %o",
					    node,splitnode);
				node.replaceChild(
				    fdjtDOM("span",before,splitnode,after),
				    split);
				return lastbottom;}
			    else if (wordoff.top>=lastbottom) { // new line
				lastbottom=linebottom;
				linebottom=wordoff.bottom;}
			    else if (wordoff.bottom>linebottom)
				linebottom=wordoff.bottom;
			    else {}}
			if (sbook.Trace.layout)
			    fdjtLog("Couldn't find split for %o at %d",
				    node,bottom);
			node.replaceChild(child,split);
			return lastbottom;}}
		else {}}
	    return lastbottom;}

	function sbookSplitNode(textnode){
	    var text=textnode.nodeValue;
	    var words=text.split(/\b/);
	    var span=fdjtDOM("span.sbookpageprobe");
	    var i=0; var len=words.length;
	    while (i<len) {
		var word=words[i++];
		var textnode=document.createTextNode(word);
		if (word.search(/\S/)>=0) {
		    var wordspan=document.createElement("span");
		    wordspan.appendChild(textnode);
		    wordspan.textValue=word;
		    span.appendChild(wordspan);}
		else span.appendChild(textnode);}
	    return span;}

	/* Post pagination adjustment */

	function AdjustPage(info){
	    if (info.adjusted) return;
	    var prev=sbook.pageinfo[info.pagenum-1];
	    var next=sbook.pageinfo[info.pagenum+1];
	    if ((info.topedge)&&(!(prev.adjusted))) {
		var newtop=AdjustPageBreak(info.topedge,prev.top,prev.bottom);
		prev.bottom=info.top=newedge;}
	    if ((info.bottomedge)&&(!(next.adjusted))) {
		var newbottom=AdjustPageBreak(info.bottomedge,info.top,info.bottom);
		next.top=info.bottom=newbottom;}
	    info.adjusted=fdjtTime();}

	/* Framing a page */
	
	var page_xoff=false; var page_yoff=false;

	function ScrollGoToPage(pagenum,pageoff,caller,nosave){
	    if (!(pageoff)) pageoff=0;
	    if ((typeof pagenum !== 'number')||
		(pagenum<0)||(pagenum>=sbook.pages.length)) {
		fdjtLog.warn("Invalid page number %o",pagenum);
		return;}
	    if (sbook.Trace.nav)
		fdjtLog("ScrollGoToPage%s %o+%o",
			((caller)?"/"+caller:""),pagenum,pageoff);
	    var info=sbook.pageinfo[pagenum];
	    var off=sbook.pages[pagenum]+pageoff;
	    if (sbook.fastpage) AdjustPage(info);
	    if (sbook.Trace.nav) {
		if ((sbook.curpage)&&(sbook.curpage>=0))
		    fdjtLog("Jumped to P%d@%d=%d+%d P%d@[%d,%d]#%s+%d (%o) from P%d@[%d,%d]#%s (%o)",
			    pagenum,off,sbook.pages[pagenum],pageoff,
			    pagenum,info.top,info.bottom,info.first.id,
			    pageoff,info,sbook.curpage,
			    sbook.curinfo.top,sbook.curinfo.bottom,
			    sbook.curinfo.first.id,sbook.curinfo);
		else fdjtLog("Jumped to %d P%d@[%d,%d]#%s+%d (%o)",
			     off,pagenum,
			     info.top,info.bottom,info.first.id,pageoff,info);}
	    updatePage(info,off);
	    updatePageDisplay(info,pagenum,pageoff);
	    sbook.curpage=pagenum;
	    sbook.curoff=pageoff;
	    sbook.curinfo=info;
	    if (true) { /* (sbook.viewTop()!==(off-sbook_top_px)) */
		if ((sbook.updatelocation)&&(info.focus)&&(info.focus.id))
		    window.location.hash=info.focus.id;
		sbook.scrollTo(0,(off));
		page_xoff=0; page_yoff=(off);
		// Add class if it's temporarily gone
		fdjtDOM.addClass(document.body,"sbookpagevertical");
		fdjtDOM.addClass(document.body,"sbookpaginated");
		fdjtDOM.dropClass(document.body,"sbookscrolling");}
	    
	    if ((sbook.target)&&(fdjtDOM.isVisible(sbook.target)))
		sbook.setHead(sbook.target);
	    else sbook.setHead(info.focus||info.first);
	    
	    sbook.setLocation(info.loc);
	    if (!(nosave))
		sbook.setState(
		    {page: pagenum,location: info.loc,
		     target:((sbook.target)&&(sbook.target.id))});}

	function GoToPage(num,off,caller,nosave){
	    if (sbook.colpage) ColumnGoToPage(num,off,caller,nosave);
	    else ScrollGoToPage(num,off,caller,nosave);}
	sbook.GoToPage=GoToPage;

	function FadeToPage(pagenum,off){
	    if (!(off)) off=0;
	    if (!(sbook.animate.pages))
		return sbook.GoToPage(pagenum,off,"FadeToPage");
	    if (sbook.Trace.nav)
		fdjtLog("sbook.FadeToPage %o+%o",pagenum,off);
	    // sbook.body.style.opacity=0.0001;
	    sbook.newpage={pagenum: pagenum,pageoff: off};
	    fdjtDOM.addClass(sbook.canvas,"pageswitch");
	    // We could probably use transition events for this
	    setTimeout(function(){
		sbook.GoToPage(pagenum,off,"FadeToPage+");
		fdjtDOM.dropClass(sbook.canvas,"pageswitch");},
		       300);}
	sbook.FadeToPage=FadeToPage;
	
	function displaySync(){
	    if (sbook.preview) return false;
	    if ((window.scrollY!==page_yoff)||(window.scrollX!==page_xoff)) {
		/*
		  fdjtLog("syncing the page, was %o,%o should be %o,%o",
		  window.scrollX,window.scrollY,page_xoff,page_yoff);
		*/
		// Only if pages are defined
		if (sbook.curpage)
		    sbook.GoToPage(sbook.curpage,0,"displaySync");}}
	sbook.displaySync=displaySync;

	function getPage(arg){
	    var top;
	    if (typeof arg === "number") top=arg;
	    else if (arg.nodeType)
		top=getGeometry(arg,sbook.body||sbook.root).top;
	    else if (!(fdjtID(arg))) return 0;
	    else top=getGeometry(arg,sbook.root).top;
	    if (sbook.bodyoff) top=top+sbook.bodyoff[1];
	    var i=1; var len=sbook.pages.length;
	    while (i<len) 
		if (sbook.pages[i]>top) return i-1;
	    else i++;
	    return i-1;}
	sbook.getPage=getPage;

	function getPageAt(loc){
	    var pages=sbook.pageinfo;
	    var i=1; var len=pages.length;
	    while (i<len) {
		if ((pages[i].loc)&&(pages[i].loc>loc)) return i-1;
		else i++;}
	    return false;}
	sbook.getPageAt=getPageAt;
	
	/* Tracing pagination */

	function tracePaging(name,elt){
	    if (!(elt)) {
		fdjtLog("%s none",name);
		return;}
	    var top=sbook.viewTop();
	    var bottom=sbook.viewTop()+((fdjtDOM.viewHeight()));
	    var offsets=getGeometry(elt,sbook_body);
	    fdjtLog("%s [%d+%d=%d] %s [%d,%d] %o%s%s%s%s '%s'\n%o",name,
		    offsets.top,offsets.height,offsets.top+offsets.height,
		    pagePlacement(offsets,top,bottom),top,bottom,
		    elt.toclevel||0,
		    (isPageHead(elt)?"/ph":""),
		    (isPageBlock(elt)?"/pb":""),
		    (avoidPageHead(elt)?"/ah":""),
		    (avoidPageFoot(elt)?"/af":""),
		    elt.id,elt);}
	sbook.tracePaging=tracePaging;

	function pagePlacement(offsets,top,bottom){
	    if (offsets.top>bottom) return "below";
	    else if (offsets.bottom<top) return "above";
	    else if (offsets.top<top) return "athead";
	    else if ((offsets.top+offsets.height)<bottom) return "inside";
	    else return "atfoot";}
	
	/* External refs */
	sbookPaginate.isPageHead=isPageHead;
	sbookPaginate.isPageBlock=isPageBlock;
	sbookPaginate.isPageFoot=isPageFoot;
	sbookPaginate.avoidPageFoot=avoidPageFoot;
	sbookPaginate.avoidPageHead=avoidPageHead;

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
		pageinfo,sbook.UI.handlers[sbook.ui]["#CODEXPAGEINFO"]);

	    var pagemask=fdjtID("CODEXMASK");
	    
	    fdjtDOM.prepend(document.body,pagehead,pagefoot);
	    
	    if (sbook.nativescroll) {
		fdjtDOM.prepend(document.body,topleading);
		fdjtDOM.append(document.body,bottomleading);}
	    else {}
	    
	    fdjtID("CODEXPAGENEXT").onclick=sbook.Forward;

	    if (!(sbook.nativescroll)) window.scrollTo(0,0);

	    // The better way to do this might be to change the stylesheet,
	    //  but fdjtDOM doesn't currently handle that 
	    var bgcolor=getBGColor(sbook.body)||getBGColor(document.body)||"white";
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
	    pagemask.style.backgroundColor=bgcolor;
	    fdjtDOM.addListener(false,"resize",resizePage);}
	sbook.initDisplay=initDisplay;
	
	function getBGColor(arg){
	    var color=fdjtDOM.getStyle(arg).backgroundColor;
	    if (!(color)) return false;
	    else if (color==="transparent") return false;
	    else if (color.search(/rgba/)>=0) return false;
	    else return color;}

	function updatePage(pageinfo,off){
	    var viewheight=sbook.page.offsetHeight;
	    var footheight=((off)+(viewheight))-pageinfo.bottom+1;
	    if (sbook.Trace.paging)
		fdjtLog("updatePage to %o (%o) footheight=%o",
			pageinfo,off,footheight);
	    if (footheight<0) { /* oversize page */
		footheight=0; sbook.curbottom=0;}
	    fdjtID("CODEXMASK").style.height=footheight+'px';
	    sbook.page_top=off;
	    sbook.page_bottom=off+viewheight;}
	
	function resizePage(){
	    var vw=fdjtDOM.viewWidth();
	    var vh=fdjtDOM.viewHeight();
	    if (!(sbook.nativescroll)) {
		window.scrollTo(0,0);
		document.body.style.width=vw+'px';
		document.body.style.height=vh+'px';}
	    sbookPaginate(sbook.paginate);}

	/* Top level functions */

	function sbookUpdatePagination(callback){
	    var pagesize=pageheight;
	    var target=sbook.target;
	    sbook.Message("Determining page layout");
	    var body=sbook.body||document.body;
	    fdjtDOM.addClass(document.body,"sbookpaginated");
	    fdjtDOM.dropClass(document.body,"sbookpagevertical");
	    fdjtDOM.dropClass(document.body,"sbookpagehorizontal");
	    if (sbook.colpage) {
		var oldbreaks=fdjtDOM.$(".sbookpagehorizontal");
		fdjtDOM.dropClass(oldbreaks,"sbookpagehorizontal");}
	    Paginate(pagesize,body,
		     function(pagination) {
			 var body=document.body;
			 sbook.pages=pagination.pages;
			 sbook.pageinfo=pagination.info;
			 sbook_pagesize=pagesize;
			 if (sbook.colpage) SetupColumnPaginate();
			 else fdjtDOM.dropClass(body,"sbookpagevertical");
			 var gotopage=sbook.getPageAt(sbook.location);
			 sbook.GoToPage(gotopage||0,0,
					"sbookUpdatePagination",true);
			 if (callback) callback(pagination);});}

	function updatePageInfo(){
	    var body=document.body;
	    fdjtDOM.dropClass(body,"sbookpagevertical");
	    fdjtDOM.dropClass(body,"sbookpagehorizontal");
	    fdjtDOM.addClass(body,"sbookpaginated");
	    var page=fdjtID("CODEXPAGE");
	    var canvas=fdjtID("CODEXCANVAS");
	    var content=fdjtID("SBOOKCONTENT");
	    var pbounds=fdjtDOM.getGeometry(page);
	    var cbounds=fdjtDOM.getGeometry(content);
	    var width=pagewidth=sbook.pagewidth=cbounds.width;
	    sbook.pageheight=pageheight=pbounds.height;
	    if (sbook.colpage) {
		var style=content.style;
		var gap=colgap=sbook.colgap=pbounds.width-width;
		style[fdjtDOM.columnWidth||"column-width"]=width+'px';
		style[fdjtDOM.columnGap||"column-gap"]=gap+'px';
		style.height=pageheight+'px';}
	    window.scrollTo(0,0);}
	
	function sbookPaginate(flag,nogo){
	    if (flag===false) {
		if (sbook.paginate) {
		    sbook.paginate=false;
		    sbook_nextpage=false; sbook_pagebreak=false;
		    fdjtDOM.dropClass(document.body,"sbookpaginated");
		    fdjtDOM.dropClass(document.body,"scrollpage");
		    fdjtDOM.dropClass(document.body,"sbookpagehorizontal");
		    if (sbook.colpage) 
			fdjtDOM.dropClass(
			    fdjtDOM.$(".sbookcolbreak"),"sbookcolbreak");
		    if (!(nogo)) {
			var curx=fdjtDOM.viewLeft(); var cury=sbook.viewTop();
			sbook.scrollTo(0,0);
			sbook.scrollTo(curx,cury);}
		    return;}
		else return;}
	    else {
		sbook.paginate=true;
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
	    updatePageInfo();
	    var newinfo={};
	    var computePages=function(){
		sbookUpdatePagination(function(result){
		    newinfo.offheight=document.body.offsetHeight;
		    newinfo.offwidth=document.body.offsetWidth;
		    newinfo.winwidth=(document.documentElement.clientWidth);
		    newinfo.winheight=(fdjtDOM.viewHeight());
		    sbook_paginated=newinfo;})};
	    adjustFullPages(computePages);}
	
	sbook.isContent=isContentBlock;
	sbook.scanContent=scanContent;

	// fdjtDOM.trace_adjust=true;

	sbookPaginate.debug=debug_pagination;

	return sbookPaginate;})();

/* Pagination utility functions */

sbook.setFontSize=function(size){
    if (sbook.body.style.fontSize!==size) {
	sbook.body.style.fontSize=size;
	sbookPaginate();}};

sbook.setUIFontSize=function(size){
    if (CodexHUD.style.fontSize!==size) CodexHUD.style.fontSize=size;};

fdjt_versions.decl("codex",codex_pagination_version);
fdjt_versions.decl("codex/pagination",codex_pagination_version);

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
