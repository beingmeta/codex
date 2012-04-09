/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* Copyright (C) 2009-2012 beingmeta, inc.
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

	var getGeometry=fdjtDOM.getGeometry;
	var hasClass=fdjtDOM.hasClass;
	var addClass=fdjtDOM.addClass;
	var dropClass=fdjtDOM.dropClass;
	var TOA=fdjtDOM.toArray;
	var isEmpty=fdjtString.isEmpty;
	var secs2short=fdjtTime.secs2short;
	var rootloop_skip=50;
	
	var atoi=parseInt;

	function Paginate(why,init){
	    
	    if (Codex.paginating) return;
	    if (!(why)) why="because";
	    addClass(document.body,"pagelayout");
	    var height=getGeometry(fdjtID("CODEXPAGE")).height;
	    var width=getGeometry(fdjtID("CODEXPAGE")).width;
	    var bodysize=Codex.bodysize||"normal";
	    var bodyfamily=Codex.bodyfamily||"serif";
	    if (Codex.paginated) {
		var current=Codex.paginated;
		if ((!(init.forced))&&
		    (width===current.page_width)&&
		    (height===current.page_height)&&
		    (bodysize===current.bodysize)&&
		    (bodyfamily===current.bodyfamily)) {
		    fdjtLog("Skipping redundant pagination %j",current);
		    return;}
		// Repaginating, start with reversion
		Codex.paginated.revert();
		Codex.paginated=false;}

	    // Create a new layout
	    var layout=new CodexLayout(getLayoutArgs());
	    layout.bodysize=bodysize; layout.bodyfamily=bodyfamily;
	    Codex.paginating=layout;
	    
	    // Prepare to do the layout
	    dropClass(document.body,"cxSCROLL");
	    addClass(document.body,"cxBYPAGE");
	    fdjtID("CODEXPAGE").style.visibility='hidden';
	    fdjtID("CODEXCONTENT").style.visibility='hidden';
	    
	    // Now walk the content
	    var content=Codex.content;
	    var nodes=TOA(content.childNodes);
	    fdjtLog("Laying out %d root nodes into %dx%d pages (%s)",
		    nodes.length,layout.width,layout.height,
		    (why||""));

	    /* Lay out the coverpage */
	    var coverpage=fdjtID("CODEXCOVERPAGE")||
		fdjtID("SBOOKCOVERPAGE")||
		fdjtID("COVERPAGE");
	    if (coverpage) {
		Codex.coverpage=coverpage;
		layout.addContent(coverpage);}
	    else {
		var coverimage=fdjtDOM.getLink("sbook.coverpage",false,false)||
		    fdjtDOM.getLink("coverpage",false,false);
		if (coverimage) {
		    var img=fdjtDOM.Image(
			coverimage,"img.codexcoverpage.sbookpage");
		    fdjtDOM.prepend(Codex.content,img);
		    Codex.coverpage=img;
		    layout.addContent(img);}}

	    var i=0; var lim=nodes.length;
	    function rootloop(){
		if (i>=lim) {
		    layout.Finish();
		    layout_progress(layout);
		    fdjtID("CODEXPAGE").style.visibility='';
		    fdjtID("CODEXCONTENT").style.visibility='';
		    dropClass(document.body,"pagelayout");
		    Codex.paginated=layout;
		    Codex.pagecount=layout.pages.length;
		    if (Codex.pagewait) {
			var fn=Codex.pagewait;
			Codex.pagewait=false;
			fn();}
		    Codex.GoTo(
			Codex.location||Codex.target||
			    Codex.coverpage||Codex.titlepage||
			    fdjtID("CODEXPAGE1"),
			"endLayout",true,true);
		    Codex.paginating=false;}
		else {
		    var root=nodes[i++];
		    var timeslice=layout.timeslice||CodexLayout.timeslice||200;
		    var timeskip=layout.timeskip||CodexLayout.timeskip||50;
		    if (((root.nodeType===3)&&(!(isEmpty(root.nodeValue))))||
			((root.nodeType===1)&&
			 (root.tagName!=='LINK')&&(root.tagName!=='META')&&
			 (root.tagName!=='SCRIPT'))) 
			layout.addContent(root,timeslice,timeskip,
					  layout.tracelevel,
					  layout_progress,rootloop);
		    else rootloop();}}

	    	/* Reporting progress, debugging */
	
	    function layout_progress(info){
		var tracelevel=info.tracelevel;
		var started=info.started;
		var pagenum=info.pagenum;
		var now=fdjtTime();
		if (!(pagenum)) return;
		if (info.done) {
		    LayoutMessage(fdjtString(
			"Finished laying out %d pages in %s",
			pagenum,secs2short((info.done-info.started)/1000)));
		    if (tracelevel)
			fdjtLog("Finished laying out %d pages in %s",
				pagenum,secs2short((info.done-info.started)/1000));}
		else {
		    if ((info.lastid)&&(Codex.docinfo)&&
			((Codex.docinfo[info.lastid]))) {
			var docinfo=Codex.docinfo;
			var maxloc=docinfo._maxloc;
			var lastloc=docinfo[info.lastid].starts_at;
			var pct=(100*lastloc)/maxloc;
			fdjtUI.ProgressBar.setProgress("CODEXLAYOUTMESSAGE",pct);
			LayoutMessage(fdjtString(
			    "Laid out %d pages (%d%%) in %s",
			    pagenum,Math.floor(pct),
			    secs2short((now-started)/1000)));
			if (tracelevel)
			    fdjtLog("Laid out %d pages (%d%%) in %s",
				    pagenum,Math.floor(pct),
				    secs2short((now-started)/1000));}
		    else {
			LayoutMessage(fdjtString(
			    "Laid out %d pages in %s",
			    info.pagenum,secs2short((now-started)/1000)));
			if (tracelevel)
			    fdjtLog("Laid out %d pages in %s",
				    info.pagenum,secs2short((now-started)/1000));}}}
	
	    function LayoutMessage(msg){
		fdjtUI.ProgressBar.setMessage("CODEXLAYOUTMESSAGE",msg);}
	    
	    rootloop();}
	Codex.Paginate=Paginate;

	CodexLayout.onresize=function(evt){
	    var page_width=fdjtDOM.getGeometry(Codex.page).width;
	    var view_width=fdjtDOM.viewWidth();
	    var page_margin=(view_width-page_width)/2;
	    if (page_margin>=50) {
		page.style.left=page_margin+'px';
		page.style.right=page_margin+'px';}
	    Codex.Paginate("resize");};
	
	Codex.addConfig(
	    "layout",
	    function(name,val){
		Codex.layout=val;
		if (val==='bypage') {
		    if (!(Codex.docinfo)) {
			// If there isn't any docinfo (during startup, for
			// instance), don't bother actually paginating.
			Codex.bypage=true;}
		    else if (!(Codex.bypage)) {
			// set this
			Codex.bypage=true;
			if (Codex.postconfig)
			    // If we're in the middle of config,
			    // push off the work of paginating
			    Codex.postconfig.push(Paginate);
			// Otherwise, paginate away
			else Codex.Paginate("config");}}
		else if (val==='bysect') {
		    // This just uses the 'Codex.sects' array
		    // In the future, we may set up a scanner in the foot
		    Codex.bysect=true;}
		else {
		    // If you've already paginated, revert
		    if (Codex.paginated) {
			Codex.paginated.Revert();
			Codex.paginated=false;}
		    else if (Codex.paginating) {
			if (Codex.paginating.timer) {
			    clearTimeout(Codex.paginating.timer);
			    Codex.paginating.timer=false;}
			Codex.paginating.Revert();
			Codex.paginating=false;}
		    else {}
		    Codex.bypage=false;
		    dropClass(document.body,"cxBYPAGE");
		    addClass(document.body,"cxSCROLL");}});

	function updateLayoutProperty(name,val){
	    // This updates layout properties
	    fdjtDOM.swapClass(
		Codex.page,new RegExp("codex"+name+"\w*"),"codex"+name+val);
	    Codex[name]=val;
	    if (Codex.paginated) {
		// If you're already paginated, repaginate.  Either
		// when done with the config or immediately.
		if (Codex.postconfig) {
		    Codex.postconfig.push(function(){
			CodexMode(true);
			Codex.Paginate(name);});}
		else {
		    CodexMode(true);
		    Codex.Paginate(name);}}}
	Codex.addConfig("bodysize",updateLayoutProperty);
	Codex.addConfig("bodyfamily",updateLayoutProperty);
	
	function getLayoutArgs(){
	    var height=getGeometry(fdjtID("CODEXPAGE")).height;
	    var width=getGeometry(fdjtID("CODEXPAGE")).width;
	    var container=fdjtDOM("div.codexpages#CODEXPAGES");
	    var pagerule=fdjtDOM.addCSSRule(
		"div.codexpage",
		"width: "+width+"px; "+"height: "+height+"px;");
	    var args={page_height: height,page_width: width,
		      container: container,pagerule: pagerule,
		      tracelevel: Codex.Trace.layout,
		      logfn: fdjtLog};
	    fdjtDOM.replace("CODEXPAGES",container);
	    
	    var avoidbreakinside=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
	    if (avoidbreakinside) args.avoidbreakinside=avoidbreakinside;

	    var forcebreakbefore=
		fdjtDOM.sel(fdjtDOM.getMeta("forcebreakbefore",true));
	    if (forcebreakbefore) args.forcebreakbefore=forcebreakbefore;

	    var forcebreakafter=
		fdjtDOM.sel(fdjtDOM.getMeta("forcebreakafter",true));
	    if (forcebreakafter) args.forcebreakafter=forcebreakafter;

	    var avoidbreakafter=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakafter",true));
	    if (avoidbreakafter) args.avoidbreakafter=avoidbreakafter;

	    var avoidbreakbefore=
		fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakbefore",true));
	    if (avoidbreakbefore) args.avoidbreakbefore=avoidbreakbefore;
	    
	    var fullpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));
	    if (fullpages) args.fullpages=fullpages;
	    
	    var floatpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfloatpage",true));
	    if (floatpages) args.floatpages=floatpages;

	    return args;}
	CodexLayout.getLayoutArgs=getLayoutArgs;

	/* Updating the page display */

	function updatePageDisplay(pagenum,location) {
	    var npages=Codex.pagecount;
	    var pbar=fdjtDOM("div.progressbar#CODEXPROGRESSBAR");
	    var book_len=Codex.ends_at;
	    pbar.style.left=(100*((pagenum-1)/npages))+"%";
	    pbar.style.width=(100/npages)+"%";
	    var locoff=
		((typeof location==='number')?
		 (fdjtDOM(
		     "span.locoff#CODEXLOCOFF","L"+Math.floor(location/128))):
		 (fdjtDOM("span.locoff#CODEXLOCOFF")));
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

	
	/* Movement by pages */
	
	var curpage=false;
	
	function GoToPage(spec,caller){
	    var page=Codex.paginated.getPage(spec)||Codex.paginated.getPage(1);
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
	    curpage=page; Codex.curpage=pagenum;
	    if (page) {
		Codex.setState(
		    {location: atoi(page.getAttribute("data-sbookloc")),
		     page: atoi(page.getAttribute("data-pagenum")),
		     target: page.getAttribute("data-topid")});}
	    var glossed=fdjtDOM.$(".glossed",page);
	    if (glossed) {
		var addGlossmark=Codex.UI.addGlossmark;
		var i=0; var lim=glossed.length;
		while (i<lim) addGlossmark(glossed[i++]);}}
	Codex.GoToPage=GoToPage;
	
	var previewing=false;
	function startPreview(spec,caller){
	    var page=Codex.paginated.getPage(spec)||Codex.paginated.getPage(1);
	    var pagenum=parseInt(page.getAttribute("data-pagenum"));
	    if (previewing===page) return;
	    if (previewing) dropClass(previewing,"curpage");
	    if (Codex.Trace.flips)
		fdjtLog("startPreview/%s to %o (%d) for %o",
			caller||"nocaller",page,pagenum,spec);
	    if (curpage) dropClass(curpage,"curpage");
	    addClass(page,"curpage");
	    addClass(document.body,"codexpreview");
	    Codex.previewing=previewing=page;
	    updatePageDisplay(pagenum,Codex.location);}
	function stopPreview(caller){
	    var pagenum=parseInt(curpage.getAttribute("data-pagenum"));
	    if (Codex.Trace.flips)
		fdjtLog("stopPreview/%s from %o to %o (%d)",
			caller||"nocaller",previewing,curpage,pagenum);
	    if (!(previewing)) return;
	    dropClass(previewing,"curpage");
	    addClass(curpage,"curpage");
	    dropClass(document.body,"codexpreview");
	    if (Codex.previewtarget) {
		dropClass(Codex.previewtarget,"codexpreviewtarget");
		fdjtUI.Highlight.clear(Codex.previewtarget,"highlightexcerpt");
		fdjtUI.Highlight.clear(Codex.previewtarget,"highlightsearch");
		Codex.previewtarget=false;}
	    Codex.previewing=previewing=false;
	    updatePageDisplay(pagenum,Codex.location);}
	Codex.startPagePreview=startPreview;
	Codex.stopPagePreview=stopPreview;

	function getPage(arg){
	    var page=Codex.paginated.getPage(arg)||Codex.paginated.getPage(1);
	    return parseInt(page.getAttribute("data-pagenum"));}
	Codex.getPage=getPage;
	
	function getPageAt(loc){
	    var elt=Codex.resolveLocation(loc);
	    return getPageElt(elt)||fdjtID("CODEXPAGE1");}
	Codex.getPageAt=getPageAt;
	
	function displaySync(){
	    if ((Codex.pagecount)&&(Codex.curpage))
		Codex.GoToPage(Codex.curpage,"displaySync");}
	Codex.displaySync=displaySync;

	return Paginate;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
