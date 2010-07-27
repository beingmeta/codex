/* -*- Mode: Javascript; -*- */

var sbooks_pagination_id=
  "$Id$";
var sbooks_pagination_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
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
	var sbook_paginated=false;
	var sbook_top_px=40;
	var sbook_bottom_px=40;
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

	var isEmpty=fdjtString.isEmpty;
	var getGeometry=fdjtDOM.getGeometry;
	var getStyle=fdjtDOM.getStyle;

	function Paginate(pagesize,start){
	    if (!(start)) start=sbook.root||document.body;
	    start=scanContent(start);
	    if (sbook.Trace.pagination)
		fdjtLog("Starting pagination at %o",start);
	    var debug=sbookPaginate.debug;
	    var result={}; var pages=[]; var pageinfo=[];
	    result.pages=pages; result.info=pageinfo;
	    var scan=start; var info=nodeInfo(scan); var style=getStyle(scan);
	    var pagetop=info.top; var pagelim=pagetop+pagesize;
	    var fudge=sbook_bottom_px/4;
	    var startedat=fdjtET();
	    var curpage={}; var newtop=false; var nodecount=1;
	    curpage.pagenum=pages.length;
	    curpage.top=pagetop; curpage.limit=pagelim;
	    curpage.first=start; curpage.last=start;
	    pages.push(pagetop); pageinfo.push(curpage);
	    while (scan) {
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
			     ("P#"+curpage.pagenum+
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
		if (sbook.Trace.pagination>1)
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
			fdjtLog.warn("[%f] Pagination got stuck with non page head %o",
				     fdjtET(),scan);
		    else if (isPageFoot(scan,style))
			fdjtLog.warn("[%f] Pagination got stuck with page foot at head %o",
				     fdjtET(),scan);
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
		// including the case where we have children which are on the page.
		else if ((info.bottom<pagelim)||((nextinfo)&&(nextinfo.top<pagelim))) {
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
			// If we're trying to avoid putting this item at the foot
			if ((scan.toclevel)||(avoidPageFoot(scan,style))) {
			    // Break here if the next item 
			    if ((nextinfo.top>=pagelim) // is off the page
				||(isPageHead(next,nextstyle)) // is a forced head
				// is a straddling no-break block
				||((nextinfo.top<pagelim)&&(nextinfo.bottom>pagelim)&&
				   (isPageBlock(next,nextstyle)))
				// is a bad foot close to the bottom
				||(((next.toclevel)||(avoidPageFoot(next,nextstyle)))&&
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
				// If it would create widows or be offpage entirely,
				// just break at the current scan
				if (newbreak<(scantop+widowthresh)) {
				    newtop=scan;
				    curpage.bottom=info.top;}
				else {
				    // otherwise, split the current block to keep
				    // the next element from being a pagehead
				    curpage.bottom=newbreak;
				    newtop=splitblock=scan;}}}
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
		else if (avoidPageHead(scan,style))
		    // If we're avoiding the head, we split this block.
		    newtop=splitblock=scan;
		else if ((sbook_fudge_bottom)&&
			 (isPageFoot(scan,style))&&
			 (info.bottom<(pagelim+sbook_fudge_bottom)))
		    // If we want to be a foot and we're close enough,
		    // just fudge the bottom, pushing it down.  This may be 
		    // a bad idea (adjust sbook_fudge_bottom accordingly)
		    curpage.bottom=info.bottom;
		// If we're too small to split, just start a new page
		else if (info.height<(widowthresh+orphanthresh))
		    newtop=scan;
		// If splitting would create a widow, just break
		else if ((pagelim-scantop)<widowthresh)
		    newtop=scan;
		// If we might create orphans, adjust the page bottom
		// to ensure that doesn't happen
		else if ((info.bottom-pagelim)<orphanthresh)
		    if ((sbook_fudge_bottom)&&
			(info.bottom<(pagelim+sbook_fudge_bottom))) {
			// possibly move the bottom down
			curpage.bottom=pagelim=info.bottom;}
		else {
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
		    if (dbginfo)
			dbginfo=dbginfo+" np"+((splitblock)?"/split":"")+"/"+curpage.bottom;
		    // Adjust the page bottom information
		    if (splitblock) {
			curpage.bottom=pagelim;
			curpage.last=splitblock;
			var newbottom=
			    ((sbook.fastpage)?(curpage.bottom):
			     (AdjustPageBreak(splitblock,curpage.top,curpage.bottom)));
			if ((newbottom>pagetop)&&(newbottom>info.top)&&
			    (newbottom>(pagetop+(pagesize/2)))) {
			    // Check that we were able to find a good page break
			    curpage.bottom=newbottom;
			    curpage.bottomedge=splitblock;
			    if (dbginfo) dbginfo=dbginfo+"~"+curpage.bottom;
			    // If we're splitting, force the next node to be the split block
			    next=splitblock; nextinfo=info;}
			else {
			    // We weren't able to find a good page break,
			    // so we break entirely (no split), and declare this
			    // page oversize
			    curpage.bottom=info.bottom; curpage.oversize=oversize=true;
			    if (dbginfo) dbginfo=dbginfo+"~oversize/"+curpage.bottom;}}
		    // If it's a clean break, make sure that the page bottom is good
		    else if (!(curpage.bottom)) curpage.bottom=newinfo.top;
		    else if (newinfo.top<curpage.bottom) curpage.bottom=newinfo.top;
		    else curpage.bottom=newinfo.top;
		    if (sbook.Trace.pagination) 
			fdjtLog("[%f] New %spage break P%d[%d,%d]#%s %o, closed P%d[%d,%d] %o",
				fdjtET(),((splitblock)?("split "):("")),
				pages.length,newinfo.top,newinfo.bottom,newtop.id,newtop,
				curpage.pagenum,curpage.top,curpage.bottom,curpage);
		    // Make a new page
		    curpage={}; curpage.pagenum=pages.length;
		    if (splitblock) curpage.top=prevpage.bottom;
		    else curpage.top=newinfo.top;
		    // If the item at the top of the new page is larger than a page,
		    // declare the page oversize
		    // (Left out for now)
		    // Initialize the first and last elements on the page
		    curpage.first=newtop; curpage.last=newtop;
		    // Indicate the straddling top element, if we're split
		    if (splitblock) curpage.topedge=splitblock;
		    // Initialize the scan variables of the page top and bottom
		    pagetop=curpage.top;
		    pagelim=curpage.limit=pagetop+pagesize;
		    scan=newtop; if (scan) style=getStyle(scan);
		    splitblock=false; newtop=false;
		    // Update the tables
		    pages.push(pagetop); pageinfo.push(curpage);}
		if (dbginfo) scan.setAttribute("sbookpagedbg",dbginfo);
		// Advance around the loop.  If we have an explicit next page,
		//  we use it (usually the case if we're splitting a block).
		if (oversize) {
		    scan=scanContent(scan,true);
		    if (scan) style=getStyle(scan);
		    if (scan) info=nodeInfo(scan);}
		else if (next) {
		    scan=next;
		    if (scan) style=getStyle(scan);
		    info=nextinfo;}
		else {
		    // Otherwise, advance through the DOM
		    scan=scanContent(scan);
		    if (scan) info=nodeInfo(scan);
		    if (scan) style=getStyle(scan);}
		if (!(splitblock)) nodecount++;}
	    var doneat=fdjtET();
	    if ((sbook.Trace.pagination)||
		((sbook.Trace.startup)&&(!(sbook._setup))))
		fdjtLog("[%f] Paginated %d nodes into %d pages with pagesize=%d in %s",
			fdjtET(),nodecount,pages.length,pagesize,
			fdjtTime.secs2short(doneat-startedat));
	    return result;}

	function isPageHead(elt,style){
	    return ((sbook_tocmajor)&&(elt.id)&&
		    ((sbook.docinfo[elt.id]).toclevel)&&
		    (((sbook.docinfo[elt.id]).toclevel)<=sbook_tocmajor))||
		(((style)||getStyle(elt)).pageBreakBefore==='always');}

	function isPageFoot(elt,style){ 
	    return (((style)||getStyle(elt)).pageBreakAfter==='always');}

	function isPageBlock(elt,style){
	    return ((elt)&&(((style)||getStyle(elt)).pageBreakInside==='avoid'));}

	function avoidPageHead(elt,style){
	    return ((elt)&&(((style)||getStyle(elt)).pageBreakBefore==='avoid'));}

	function avoidPageFoot(elt,style){
	    return ((elt.id)&&(sbook.docinfo[elt.id])&&
		    ((sbook.docinfo[elt.id]).toclevel))||
		(((style)||getStyle(elt)).pageBreakAfter==='avoid');}

	function nodeInfo(node,style){
	    var info=getGeometry(node);
	    var fontsize=((style)||getStyle(node)).fontSize;
	    if ((fontsize)&&(typeof fontsize === 'string'))
		fontsize=parseInt(fontsize.slice(0,fontsize.length-2));
	    info.fontsize=(fontsize||12);
	    return info;}

	var sbook_content_nodes=['IMG','BR','HR'];
	
	function scanContent(scan,skipchildren){
	    var next=(((skipchildren)||(scan.sbookui))?
		      (fdjtDOM.next(scan,isContentBlock)):
		      (fdjtDOM.forward(scan,isContentBlock)));
	    var info=getGeometry(scan);
	    var nextinfo=((next)&&(getGeometry(next)));
	    if (!(next)) {}
	    else if ((nextinfo.height===0)||(nextinfo.top<info.top)) 
		// Skip over weird nodes
		return scanContent(next,skipchildren);
	    else if ((isPageHead(next))||(isPageBlock(next))) {}
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
			     (styleinfo.display==='list-item'))
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
		fdjtLog("[%f] %s '%s' [%d,%d] %d%s%s%s%s%s %o",
			fdjtET(),name,elt.id,info.top,info.bottom,
			elt.toclevel||0,
			((isPageHead(elt))?"/ph":""),
			((isPageBlock(elt))?"/pb":""),
			((avoidPageHead(elt))?"/ah":""),
			((avoidPageFoot(elt))?"/af":""),
			((fdjtDOM.hasText(elt))?"/ht":""),
			elt);
	    else fdjtLog("[%f] %s none",fdjtET(),name);}

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
	
	/* This adjusts the offset of a page and its successor to avoid widows */
	
	function AdjustPageBreak(node,top,bottom,style){
	    var nodeinfo=getGeometry(node);
	    var styleinfo=((style)||getStyle(node));
	    var lastbottom=nodeinfo.top;
	    var linebottom=lastbottom;
	    var children=node.childNodes;
	    var len=children.length; 
	    var i=0; while (i<len) {
		var child=children[i++];
		if (child.nodeType===1)
		    if (child.sbookinui) continue;
		else {
		    var offinfo=getGeometry(child);
		    if ((!(offinfo))||(offinfo.height===0)) continue;
		    else if (offinfo.bottom<top) continue;
		    else if (offinfo.bottom>=bottom)
			return lastbottom;
		    else if (offinfo.top>=lastbottom) { // new line 
			lastbottom=linebottom;
			linebottom=offinfo.bottom;}
		    else if (offinfo.bottom>linebottom)
			linebottom=offinfo.bottom;
		    else {}}
		else if (child.nodeType===3) {
		    // Make the text into a span
		    var chunk=fdjtDOM("span",child.nodeValue);
		    node.replaceChild(chunk,child);
		    var offinfo=getGeometry(chunk);
		    if ((!(offinfo))||(offinfo.height===0)) {
			node.replaceChild(child,chunk);
			continue;}
		    else if (offinfo.bottom<top) {
			node.replaceChild(child,chunk);
			continue;}
		    else if (offinfo.top>=bottom) {
			// if it's over the bottom, put it back
			// and use the last bottom
			node.replaceChild(child,chunk);
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
			    var wordoff=getGeometry(word);
			    if (wordoff.bottom<top) continue;
			    else if (wordoff.bottom>=bottom) {
				// As soon as we're over the bottom, we return the last bottom
				node.replaceChild(child,split);
				return lastbottom;}
			    else if (wordoff.top>=lastbottom) { // new line
				lastbottom=linebottom;
				linebottom=wordoff.bottom;}
			    else if (wordoff.bottom>linebottom)
				linebottom=wordoff.bottom;
			    else {}}
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

	function GoToPage(pagenum,pageoff,caller){
	    if (!(pageoff)) pageoff=0;
	    if ((typeof pagenum !== 'number')||
		(pagenum<0)||(pagenum>=sbook.pages.length)) {
		fdjtLog.warn("[%f] Invalid page number %o",fdjtET(),pagenum);
		return;}
	    if (sbook.Trace.nav)
		fdjtLog("[%f] sbook.GoToPage%s %o+%o",
			fdjtET(),((caller)?"/"+caller:""),pagenum,pageoff);
	    var info=sbook.pageinfo[pagenum];
	    var off=sbook.pages[pagenum]+pageoff;
	    if (sbook.fastpage) AdjustPage(info);
	    if (sbook.Trace.nav) 
		if ((sbook.curpage)&&(sbook.curpage>=0))
		    fdjtLog("[%f] Jumped to P%d@%d=%d+%d P%d@[%d,%d]#%s+%d (%o) from P%d@[%d,%d]#%s (%o)",
			    fdjtET(),pagenum,off,sbook.pages[pagenum],pageoff,
			    pagenum,info.top,info.bottom,info.first.id,
			    pageoff,info,sbook.curpage,
			    sbook.curinfo.top,sbook.curinfo.bottom,
			    sbook.curinfo.first.id,sbook.curinfo);
	    else ("[%f] Jumped to %d P%d@[%d,%d]#%s+%d (%o)",
		  fdjtET(),off,
		  pagenum,info.top,info.bottom,info.first.id,pageoff,info);
	    if (sbook.floathud) moveMargins(info);
	    else {
		var footheight=
		    ((off-sbook_top_px)+(fdjtDOM.viewHeight()))-info.bottom;
		if (footheight<0) {
		    footheight=0; sbook.curbottom=sbook_bottom_px;}
		fdjtID("SBOOKPAGEFOOT").style.height=footheight+'px';}
	    var npages=sbook.pageinfo.length;
	    var pbar=fdjtDOM("div.progressbar");
	    var starts_at=info.top+pageoff; var ends_at=info.bottom;
	    var book_len=sbook.pageinfo[npages-1].bottom;
	    pbar.style.left=(100*(starts_at/book_len))+"%";
	    pbar.style.width=((100*(ends_at-starts_at))/book_len)+"%";
	    var pageno=
		fdjtDOM("div#SBOOKPAGENO",
			pbar,pagenum+1,((pageoff)?"+":""),"/",npages);
	    fdjtDOM.replace("SBOOKPAGENO",pageno);
	    sbook.curpage=pagenum;
	    sbook.curoff=pageoff;
	    sbook.curinfo=info;
	    if (fdjtDOM.viewTop()!==(off-sbook_top_px)) {
		if ((sbook.updatelocation)&&(info.focus)&&(info.focus.id))
		    window.location.hash=info.focus.id;
		if (sbook.floathud) sbook.syncHUD((off-sbook_top_px));
		window.scrollTo(0,(off-sbook_top_px));
		page_xoff=0; page_yoff=(off-sbook_top_px);}
	    if ((sbook.target)&&(fdjtDOM.isVisible(sbook.target)))
		sbook.setHead(sbook.target);
	    else sbook.setHead(info.focus||info.first);
	    
	    if (((info.first)&&(info.first.id))||((info.last)&&(info.last.id))) {
		var firstloc=
		    ((info.first)&&(info.first.id)&&
		     (sbook.docinfo[info.first.id])&&
		     (sbook.docinfo[info.first.id].starts_at));
		var lastloc=
		    ((info.last)&&(info.last.id)&&
		     (sbook.docinfo[info.last.id])&&
		     (sbook.docinfo[info.last.id].starts_at));
		if ((firstloc)&&(lastloc))
		    sbook.setLocation(Math.floor((firstloc+lastloc)/2));
		else if (firstloc) sbook.setLocation(firstloc);
		else if (lastloc) sbook.setLocation(lastloc);}

	    sbook.checkTarget();
	    if ((sbook.mode==="mark")&&
		(!(fdjtDOM.isVisible(sbook.mark_target))))
		sbookMode(false);
	    sbook.pagescroll=fdjtDOM.viewTop();
	    sbook.HUD.style.display='';
	    // Add class if it's temporarily gone
	    fdjtDOM.addClass(document.body,"paginate");}
	sbook.GoToPage=GoToPage;

	function FadeToPage(pagenum,off){
	    if (!(off)) off=0;
	    if (!(sbook.animate)) return GoToPage(pagenum,off,"FadeToPage");
	    if (sbook.Trace.nav)
		fdjtLog("[%f] sbook.FadeToPage %o+%o",fdjtET(),pagenum,off);
	    sbook.body.style.opacity=0.0001;
	    sbook.HUD.style.opacity=0.0001;	    
	    fdjtDOM.addClass(document.body,"pageswitch");
	    setTimeout(function(){
		GoToPage(pagenum,off,"FadeToPage+");
		sbook.HUD.style.opacity=1.0;	    
		sbook.body.style.opacity=1.0;
		setTimeout(function(){
		    fdjtDOM.dropClass(document.body,"pageswitch");
		    sbook.HUD.style.opacity="";	    
		    sbook.body.style.opacity="";},
			   200);},
		       200);}
	sbook.FadeToPage=FadeToPage;
	
	function displaySync(){
	    if (sbook.preview) return false;
	    if ((window.scrollY!==page_yoff)||(window.scrollX!==page_xoff)) {
		/*
		  fdjtLog("[%f] syncing the page, was %o,%o should be %o,%o",
		  fdjtET(),window.scrollX,window.scrollY,page_xoff,page_yoff);
		*/
		// Only if pages are defined
		if (sbook.curpage) GoToPage(sbook.curpage,0,"displaySync");}
	    if ((sbook.hudup)&&(sbook.floathud)) sbook.syncHUD();}
	sbook.displaySync=displaySync;

	function sbookGetPage(arg){
	    var top;
	    if (typeof arg === "number") top=arg;
	    else if (arg.nodeType)
		top=getGeometry(arg).top;
	    else if (!(fdjtID(arg))) return 0;
	    else top=getGeometry(fdjtID(arg)).top;
	    var i=1; var len=sbook.pages.length;
	    while (i<len) 
		if (sbook.pages[i]>top) return i-1;
	    else i++;
	    return i-1;}
	sbook.getPage=sbookGetPage;
	
	/* Tracing pagination */

	function tracePaging(name,elt){
	    if (!(elt)) {
		fdjtLog("[%f] %s none",fdjtET(),name);
		return;}
	    var top=fdjtDOM.viewTop()+sbook_top_px;
	    var bottom=fdjtDOM.viewTop()+((fdjtDOM.viewHeight())-sbook_bottom_px);
	    var offsets=getGeometry(elt);
	    fdjtLog("[%f] %s [%d+%d=%d] %s [%d,%d] %o%s%s%s%s '%s'\n%o",
		    fdjtET(),name,
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
	
	/* Margin creation */

	function initDisplay(){
	    var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
	    var bottomleading=fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
	    topleading.sbookui=true; bottomleading.sbookui=true;

	    var pagehead=fdjtDOM("div.sbookmargin#SBOOKPAGEHEAD"," ");
	    var pagefoot=fdjtDOM("div.sbookmargin#SBOOKPAGEFOOT"," ",
				 fdjtDOM("div#SBOOKPAGEINFO",
					 fdjtDOM("div#SBOOKPAGENO","p/n")));
	    pagehead.sbookui=true; pagefoot.sbookui=true;
	    sbookPageHead=pagehead; sbookPageFoot=pagefoot;

	    var leftedge=fdjtDOM("div.sbookmargin#SBOOKPAGELEFT",".");
	    var rightedge=fdjtDOM("div.sbookmargin#SBOOKPAGERIGHT",".");
	    leftedge.sbookui=true; rightedge.sbookui=true;

	    if (sbook.mobilesafari) {
		var head=fdjtDOM.$("HEAD")[0];
		var dash=fdjtID("SBOOKDASH");
		var appmeta=fdjtDOM("META");
		appmeta.name='apple-mobile-web-app-capable';
		appmeta.content='yes';
		fdjtDOM.prepend(head,appmeta);
		var viewmeta=fdjtDOM("META");
		viewmeta.name='viewport';
		viewmeta.content='user-scalable=no,width=device-width,height=device-height';
		fdjtDOM.prepend(head,viewmeta);}
	    
	    if (sbook.floathud) {
		fdjtDOM.addClass(document.body,"floathud");}

	    fdjtDOM.insertAfter(sbookHUD,
				pagehead,pagefoot,
				leftedge,rightedge,
				topleading);  
	    fdjtDOM.append(document.body,bottomleading);
	    
	    // Probe the size of the head and foot
	    pagehead.style.display='block'; pagefoot.style.display='block';
	    sbook_top_px=pagehead.offsetHeight;
	    sbook_bottom_px=pagefoot.offsetHeight;
	    pagehead.style.display=''; pagefoot.style.display='';

	    // The better way to do this might be to change the stylesheet,
	    //  but fdjtDOM doesn't handle that currently
	    var bgcolor=document.body.style.backgroundColor;
	    if (!(bgcolor)) {
		var bodystyle=fdjtDOM.getStyle(document.body);
		var bgcolor=((bodystyle)&&(bodystyle.backgroundColor));
		if ((bgcolor==='transparent')||(bgcolor.search('rgba')>=0))
		    bgcolor=false;}
	    if (bgcolor) {
		pagehead.style.backgroundColor=bgcolor;
		pagefoot.style.backgroundColor=bgcolor;}}
	sbook.initDisplay=initDisplay;
	
	function moveMargins(pageinfo){
	    fdjtID("SBOOKPAGELEFT").style.top=pageinfo.top+'px';
	    fdjtID("SBOOKPAGERIGHT").style.top=pageinfo.top+'px';
	    fdjtID("SBOOKPAGEHEAD").style.height=pageinfo.top+'px';
	    fdjtID("SBOOKPAGEFOOT").style.top=pageinfo.bottom+'px';
	    fdjtID("SBOOKPAGEFOOT").style.height=fdjtDOM.viewHeight()+'px';
	    
	    var scrollto=pageinfo.top-sbook_top_px;
	    var viewbottom=scrollto+fdjtDOM.viewHeight();
	    var footheight=viewbottom-pageinfo.bottom;
	    fdjtID("SBOOKPAGEINFO").style.top=
		(footheight-fdjtID("SBOOKPAGEINFO").offsetHeight)+'px';

	    if (sbook.Trace.paging)
		fdjtLog("Moved margins for %o to head=%o and foot=%o",
			pageinfo,
			fdjtID("SBOOKPAGEHEAD").style,
			fdjtID("SBOOKPAGEFOOT").style);}

	/* Top level functions */

	function sbookUpdatePagination(){
	    var pagesize=(fdjtDOM.viewHeight())-
		(sbook_top_px+sbook_bottom_px);
	    var target=sbook.target;
	    sbook.Message("Determining page layout");
	    var pagination=Paginate(pagesize);
	    fdjtLog("[%f] sbookUpdatePagination()",fdjtET());
	    fdjtID("SBOOKBOTTOMLEADING").style.height=pagesize+'px';
	    sbook.pages=pagination.pages;
	    sbook.pageinfo=pagination.info;
	    sbook_pagesize=pagesize;
	    sbook.Flash(2000,"Done with page layout");
	    if (target)
		sbook.GoToPage(sbook.getPage(target),0,"sbookUpdatePagination");
	    else sbook.GoToPage(sbook.getPage(fdjtDOM.viewTop()),0,"sbookUpdatePagination/nt");}

	function sbookPaginate(flag,nogo){
	    if (flag===false) {
		if (sbook.paginate) {
		    sbook.paginate=false;
		    sbook_nextpage=false; sbook_pagebreak=false;
		    fdjtUI.CheckSpan.set(fdjtID("SBOOKPAGINATE"),false,true);
		    fdjtDOM.dropClass(document.body,"paginate");
		    if (!(nogo)) {
			var curx=fdjtDOM.viewLeft(); var cury=fdjtDOM.viewTop();
			window.scrollTo(0,0);
			window.scrollTo(curx,cury);}
		    return;}
		else return;}
	    else {
		sbook.paginate=true;
		fdjtUI.CheckSpan.set(fdjtID("SBOOKPAGINATE"),true,true);
		fdjtDOM.addClass(document.body,"paginate");}
	    if ((sbook_paginated)&&
		(sbook_paginated.offheight===document.body.offsetHeight)&&
		(sbook_paginated.offwidth===document.body.offsetWidth)&&
		(sbook_paginated.winwidth===(document.documentElement.clientWidth))&&
		(sbook_paginated.winheight===(fdjtDOM.viewHeight()))) {
		return false;}
	    else repaginate();}
	
	function repaginate(){
	    var newinfo={};
	    var pagesize=(fdjtDOM.viewHeight())-
		(sbook_top_px+sbook_bottom_px);
	    var pagewidth=(fdjtDOM.viewWidth())-
		(sbook_left_px+sbook_right_px)
	    var fullpages=fdjtDOM.$(".fullpage");
	    var i=0; var lim=fullpages.length;
	    while (i<lim) {
		var block=fullpages[i++];
		block.style.maxHeight=pagesize+'px';
		block.style.height=pagesize+'px';}
	    var adjustpages=function(){
		i=0; while (i<lim) {
		    var block=fullpages[i++];
		    fdjtDOM.adjustToFit(block,0.1);}
		document.body.className=document.body.className;};
	    var finalizepages=function(){
		// This tries to assure that the pages all include all their content
		i=0; while (i<lim) {
		    var block=fullpages[i++]; fdjtDOM.finishScale(block);}
		document.body.className=document.body.className;};
	    fdjtTime.timeslice(
		[adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
		 adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
		 finalizepages,
		 function(){sbookUpdatePagination();},
		 function(){
		     newinfo.offheight=document.body.offsetHeight;
		     newinfo.offwidth=document.body.offsetWidth;
		     newinfo.winwidth=(document.documentElement.clientWidth);
		     newinfo.winheight=(fdjtDOM.viewHeight());
		     // fdjtTrace("Updated pagination from %o to %o",
		     //           sbook_paginated,newinfo);
		     if (!(sbook.paginated))
			 window.onresize=function(evt){
			     fdjtLog("[%f] Resize event %o",fdjtET(),evt);
			     sbookPaginate(sbook.paginate);};
		     sbook_paginated=newinfo;
		     sbook.GoToPage(sbook.getPage(sbook.target||sbook.root),0,"repaginate");}],
		0,100);}

	sbook.isContent=isContentBlock;
	sbook.scanContent=scanContent;

	sbook.pageTop=function(){return sbook_top_px;}
	sbook.pageBottom=function(){return sbook_bottom_px;}
	sbook.pageLeft=function(){return sbook_left_px;}
	sbook.pageRight=function(){return sbook_right_px;}
	sbook.pageSize=function(){return sbook_pagesize;}

	// sbookPaginate.debug=true;

	return sbookPaginate;})();

/* Pagination utility functions */

sbook.setFontSize=function(size){
    if (document.body.style.fontSize!==size) {
	document.body.style.fontSize=size;
	sbookPaginate();}};

sbook.setUIFontSize=function(size){
    if (sbookHUD.style.fontSize!==size) sbookHUD.style.fontSize=size;};


/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
