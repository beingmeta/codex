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
	var addClass=fdjtDOM.addClass;

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
		document.body.className=document.body.className;};
	    fdjtTime.timeslice
	    ([adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
	      adjustpages,adjustpages,adjustpages,adjustpages,adjustpages,
	      finish_scaling,finalizepages,alldone],
	     0,100);}

	/* Updating the page display */

	function updatePageDisplay(pagenum,location) {
	    var npages=sbook.pagecount;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=sbook.ends_at;
	    pbar.style.left=(100*(pagenum/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff=fdjtDOM("span.locoff#CODEXLOCOFF","L"+Math.floor(location/128));
	    var pageno_text=fdjtDOM("span#CODEXPAGENOTEXT.pageno",pagenum+1,"/",npages);
	    var pageno=fdjtDOM("div#CODEXPAGENO",locoff,pageno_text);
	    fdjtDOM.replace("CODEXPAGENO",pageno);
	    fdjtDOM.replace("CODEXPROGRESSBAR",pbar);
	    locoff.title="click to jump to a particular location";
	    fdjtDOM.addListeners
	      (locoff,sbook.UI.handlers[sbook.ui]["#CODEXLOCOFF"]);
	    pageno_text.title="click to jump to a particular page";
	    fdjtDOM.addListeners
	      (pageno_text,sbook.UI.handlers[sbook.ui]["#CODEXPAGENOTEXT"]);}

	/* Pagination */

	var vpages=true;

	function Paginate(content){
	    var page=sbook.page;
	    var pages=sbook.pages;
	    var content=sbook.content;
	    var content_dim=getGeometry(content,pages);
	    var vwidth=fdjtDOM.viewWidth();
	    var height=page.offsetHeight;
	    var width=page.offsetWidth;
	    var forced=[]; var pagetops=[];
	    var curpage=-1;
	    content.style.maxWidth=content.style.minWidth=width+"px";
	    pages.style.height=height+"px";
	    pages.style[fdjtDOM.columnWidth]=width+"px";
	    pages.style[fdjtDOM.columnGap]=(vwidth-width)+"px";
	    if (sbook.forced_breaks)
		fdjtDOM.dropClass(sbook.forced_breaks,"codexpagebreak");
	    sbook.forced_breaks=[];
	    vpages=(!(content_dim.width>vwidth));
	    var content_dim=getGeometry(content,pages);
	    var scan=scanContent(content), next=scanContent(scan), prev=false;
	    function forceBreak(elt,prev){
		if (fdjtDOM.hasClass(elt,"codexpagebreak")) return;
		if (avoidPageFoot(prev))
		    fdjtDOM.addClass(prev,"codexpagebreak");
		else fdjtDOM.addClass(elt,"codexpagebreak");
		var page=((vpages)?(elt.offsetTop/height):(elt.offsetLeft/vwidth));
		var pos=page%1;
		if (sbook.Trace.pagination)
		    fdjtLog("forceBreak %o ot=%o ch=%o h=%o page=%o, pos=%o",
			    elt,elt.offsetHeight,elt.clientHeight,height,page,pos);
		if (pos>0.05) {
		    var delta=Math.floor((1-pos)*height);
		    var top_margin=fdjtDOM.parsePX(getStyle(elt).marginTop)||0;
		    elt.style.marginTop=(Math.floor(top_margin+delta))+"px";}
		forced.push(elt);}
	    function handle_known_breaks() {
		var breaks=fdjtDOM.getChildren(content,"sbookpagebreak");
		var i=0; var lim=breaks.length;
		while (i<lim) forceBreak(breaks[i++],false);
		if (sbook_forcepagehead) {
		    var breaks=fdjtDOM.getChildren(content,sbook_forcepagehead);
		    var i=0; var lim=breaks.length;
		    while (i<lim) forceBreak(breaks[i++],false);}}
	    // handle_known_breaks();
	    while (scan) {
		var geom=getGeometry(scan,content);
		var next_geom=((next)&&(getGeometry(scan,content)));
		var top=geom.top; var bottom=geom.top+geom.height;
		var starts_at=((vpages)?(geom.top/height):(geom.left/vwidth));
		var ends_at=((vpages)?(geom.bottom/height):(geom.right/vwidth));
		var startpage=Math.floor(starts_at), endpage=Math.floor(ends_at);
		var nextpage=((next_geom)&&
			      ((vpages)?(next_geom.top/height):(next_geom.left/vwidth)));
		var break_after=((next)&&(endpage!==Math.floor(nextpage)));
		if (isPageHead(scan)) forceBreak(scan,prev);
		else if ((isPageBlock(scan))&&(startpage!==endpage)) forceBreak(scan,prev);
		else if ((next)&&(isPageFoot(scan))) forceBreak(next,prev);
		else if ((break_after)&&(avoidPageFoot(scan))) forceBreak(scan,prev);
		else {}
		// Get the new geometry, assuming the DOM is updated synchronously
		geom=getGeometry(scan,content);
		var newpage=Math.floor(geom.top/height);
		if (newpage!==curpage) {
		    pagetops[newpage]=scan;
		    curpage=newpage;}
		prev=scan;
		if (scan=next) next=scanContent(scan);
		else next=null;}
	    var content_dim=getGeometry(content,pages);
	    var pagecount=sbook.pagecount=
		((content_dim.width>vwidth)?
		 (Math.ceil(content_dim.width/vwidth)):
		 (Math.ceil(content_dim.height/height)));
	    pages.style.width=pages.style.maxWidth=
		pages.style.minWidth=(pagecount*vwidth)+"px";
	    sbook.page_width=width;
	    sbook.page_height=height;
	    sbook.vwidth=vwidth;
	    sbook.pagetops=pagetops;
	    sbook.forced_breaks=forced;}

	function clearPagination(){
	    /* Reset pageination info */
	    var pages=sbook.pages;
	    pages.style.height="";
	    pages.style[fdjtDOM.columnWidth]="";
	    pages.style[fdjtDOM.columnGap]="";}
	
	/* Pagination support functions */

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
	var page_block_classes=
	    /(\bfullpage\b)|(\btitlepage\b)|(\bsbookfullpage\b)|(\bsbooktitlepage\b)/;
	function isPageBlock(elt,style){
	    if (!(elt)) return false;
	    if (elt.tagName==='IMG') return true;
	    if (!(style)) style=getStyle(elt);
	    return (style.pageBreakInside==='avoid')||
		(elt.className.search(page_block_classes)>=0)||
		((sbook_avoidpagebreak)&&(sbook_avoidpagebreak.match(elt)));}

	function avoidPageHead(elt,style){
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    return ((style.pageBreakBefore==='avoid')||
		    ((sbook_avoidpagehead)&&(sbook_avoidpagehead.match(elt))));}

	function avoidPageFoot(elt,style){
	    if (!(elt)) return false;
	    if (!(style)) style=getStyle(elt);
	    if (style.pageBreakAfter==='avoid') return true;
	    else if (style.pageBreakAfter) return false;
	    else if ((elt.id)&&(sbook.docinfo[elt.id])&&
		     ((sbook.docinfo[elt.id]).toclevel))
		return true;
	    else return false;}

	function nodeInfo(node,style){
	    var info=getGeometry(node,sbook_body);
	    if (!(style)) style=getStyle(node);
	    var fontsize=style.fontSize;
	    if ((fontsize)&&(typeof fontsize === 'string'))
		fontsize=parseInt(fontsize.slice(0,fontsize.length-2));
	    info.fontsize=(fontsize||12);
	    info.margin_top=parsePX(style.marginTop)||0;
	    info.padding_top=parsePX(style.paddingTop)||0;
	    info.margin_bottom=parsePX(style.marginBottom)||0;
	    info.padding_bottom=parsePX(style.paddingBottom)||0;
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

	function GoToPage(num,off,caller,nosave){
	    if (sbook.Trace.nav)
		fdjtLog("GoToPage%s %o, hoff=%o",
			((caller)?"/"+caller:""),pageno,hoff);
	    sbook.pages.style.setProperty(
		fdjtDOM.transform,
		"translate("+(-((num*(sbook.vwidth+1))+(off||0)))+"px,0px)",
		"important");
	    var ptop=sbook.pagetops[num];
	    while (ptop) {
		if ((ptop.id)&&(sbook.docinfo[ptop.id])) break;
		else ptop=ptop.parentNode;}
	    if (ptop) {
		var info=sbook.docinfo[ptop.id];
		updatePageDisplay(num,info.starts_at);}
	    sbook.curpage=num;
	    if (false) /* (!(nosave)) to fix */
		sbook.setState(
		    {page: pageno,location: info.loc,
		     target:((sbook.target)&&(sbook.target.id))});}
	sbook.GoToPage=GoToPage;
	sbook.FadeToPage=GoToPage;
	
	function getPage(elt){
	    if (typeof elt === 'string') elt=fdjtID(elt);
	    if (!(elt)) return 0;
	    var vwidth=fdjtDOM.viewWidth();
	    var content_dim=fdjtDOM.getGeometry(sbook.content,sbook.pages);
	    var geom=fdjtDOM.getGeometry(elt,sbook.content);
	    var boxheight=sbook.page.offsetHeight;
	    return ((content_dim.width>vwidth)?
		    (Math.floor(geom.left/vwidth)):
		    (Math.floor(geom.top/sbook.page_height)))
	    return elt.offsetTop/boxheight;}
	sbook.getPage=getPage;
	
	function getPageAt(loc){
	    var elt=sbook.resolveLocation(loc);
	    return getPage(elt);}
	sbook.getPageAt=getPageAt;
	
	function displaySync(){
	    if (sbook.preview) return false;
	    if (sbook.pagecount)
		sbook.GoToPage(sbook.curpage,0,"displaySync");}
	sbook.displaySync=displaySync;

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
	    // pagemask.style.backgroundColor=bgcolor;
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
	    var target=sbook.target;
	    sbook.Message("Determining page layout");
	    var body=sbook.body||document.body;
	    fdjtDOM.addClass(document.body,"sbookpaginated");
	    clearPagination();
	    Paginate(sbook.content);
	    var gotopage=sbook.getPageAt(sbook.location);
	    sbook.GoToPage(gotopage||0,0,
			   "sbookUpdatePagination",true);
	    if (callback) callback();}

	function updatePageInfo(){
	    var body=document.body;
	    fdjtDOM.dropClass(body,"sbookpagevertical");
	    fdjtDOM.dropClass(body,"sbookpagehorizontal");
	    fdjtDOM.addClass(body,"sbookpaginated");
	    var page=fdjtID("CODEXPAGE");
	    var pages=fdjtID("CODEXPAGES");
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
