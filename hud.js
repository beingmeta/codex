/* -*- Mode: Javascript; -*- */

var sbooks_hud_id="$Id$";
var sbooks_hud_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
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

var sbookMode=
    (function(){
	// The foot HUD
	var sbookHead=false; var head_height=false;
	// The foot HUD
	var sbookFoot=false; var foot_height=false;
	// The HELP HUD, and its margins
	var sbookHelp=false; var help_top=false; var help_bottom=false;
	// The BOX HUD (contains scrollable content) and its margins
	var box_top=false; var box_bottom=false;
	// This is the HUD where all glosses are displayed
	var sbookGlossesHUD=false;
	// This is the HUD for tag searching
	var sbookSearchHUD=false;
	// This is the TOC HUD for navigation
	var sbookNavHUD=false;
	// How long to let messages flash up
	var message_timeout=5000;
	
	function initHUD(){
	    if (fdjtID("SBOOKHUD")) return;
	    else {
		sbook.HUD=sbookHUD=fdjtDOM("div#SBOOKHUD");
		sbookHUD.sbookui=true;
		sbookHUD.innerHTML=
		  sbook_hudtext.replace('%HELPTEXT',sbook_helptext);
		fdjtDOM.prepend(document.body,sbookHUD);}
	    var console=fdjtID("SBOOKCONSOLE");
	    console.innerHTML=sbook_console;
	    var flyleaf=fdjtID("SBOOKFLYLEAF");
	    flyleaf.innerHTML=sbook_flyleaftext;
	    // Initialize search UI
	    var search=fdjtID("SBOOKSEARCH");
	    search.innerHTML=sbook_searchbox;
	    sbook.empty_cloud=
		new fdjtUI.Completions(fdjtID("SBOOKSEARCHCLOUD"));
	    var login=fdjtID("SBOOKAPPLOGIN");
	    login.innerHTML=sbook_loginform;

	    if (sbook.hidehelp) sbook.setConfig("hidehelp");

	    fdjtID("SBOOK_RETURN_TO").value=location.href;

	    // Initialize gloss UI
	    var glosses=fdjtID("SBOOKALLGLOSSES");
	    sbook.UI.setupSummaryDiv(glosses);
	    sbook.glosses.addEffect("user",function(f,p,v){
		sbook.sourcekb.ref(v).oninit
		(sbook.UI.addGlossSource,"newsource");});
	    sbook.glosses.addEffect("distribution",function(f,p,v){
		sbook.sourcekb.ref(v).oninit
		(sbook.UI.addGlossSource,"newsource");});

	    function initUI4Item(item){
		if (document.getElementById(item.frag)) {
		    sbook.UI.addToSlice(item,glosses,false);
		    var glossmark=sbook.UI.addGlossmark(item.frag); {
			if (glossmark) {
			    var curglosses=glossmark.glosses;
			    curglosses.push(item.qid);}
			if (item.tstamp>sbook.syncstamp)
			    sbook.syncstamp=item.tstamp;
			var pic=((fdjtKB.ref(item.user)).pic)||
			    ((fdjtKB.ref(item.feed)).pic);
			if (pic) {
			    var img=fdjtDOM.getFirstChild(glossmark,"IMG.big");
			    if (img) img.src=pic;}}
		    if (item.tags) addTag2UI(item.tags,true);}}
	    sbook.glosses.addInit(initUI4Item);

	    function addTag2UI(tag,forsearch){
		if (!(tag)) return;
		else if (tag instanceof Array) {
		    var i=0; var lim=tag.length;
		    while (i<lim) addTag2UI(tag[i++],forsearch||false);
		    return;}
		else {
		    var gloss_cloud=sbook.glossCloud();
		    var search_cloud=sbook.FullCloud();
		    var gloss_tag=gloss_cloud.getByValue(tag,".completion");
		    if (!((gloss_tag)&&(gloss_tag.length))) {
			gloss_tag=Knodule.HTML(tag,sbook.knodule,false,true);
			fdjtDOM(fdjtID("SBOOKGLOSSTAGS"),gloss_tag," ");
			gloss_cloud.addCompletion(gloss_tag);}
		    var search_tag=((forsearch)&&(search_cloud.getByValue(tag,".completion")));
		    if ((forsearch)&&(!((search_tag)&&(search_tag.length)))) {
			search_tag=Knodule.HTML(tag,sbook.knodule,false,true);
			fdjtDOM(fdjtID("SBOOKSEARCHTAGS"),search_tag," ");
			search_cloud.addCompletion(search_tag);}}}
	    sbook.addTag2UI=addTag2UI;
	    
	    sbookFoot=fdjtID("SBOOKFOOT");
	    sbookHead=fdjtID("SBOOKHEAD");
	    sbookHelp=fdjtID("SBOOKHELP");
	    fillinFlyleaf();
	    resizeHUD();
	    sbook.scrollers={};
	    updateScroller("SBOOKGLOSSCLOUD");
	    updateScroller("SBOOKSEARCHCLOUD");}
	sbook.initHUD=initHUD;
	
	function fixStaticRefs(string){
	  if (sbook.graphics==="http://static.beingmeta.com/graphics/")
	    return string;
	  else return string.replace
		 (/http:\/\/static.beingmeta.com\/graphics\//g,
		  sbook.graphics);}

	function resizeHUD(){
	    var vh=fdjtDOM.viewHeight();
	    var vw=fdjtDOM.viewWidth();
	    var hf=fdjtID("SBOOKFOOT");
	    var fh=fdjtDOM.getGeometry(hf).height;
	    // fdjtLog("[%fs] resizeHUD vh=%o vw=%o fh=%o",fdjtET(),vh,vw,fh);
	    if (!(sbook.nativescroll)) hf.style.top=(vh-fh)+'px';}

	/* This is used for viewport-based browser, where the HUD moves
	   to be aligned with the viewport */
	
	var sbook_sync_off=false;
	var sbook_sync_height=false;
	
	function getBounds(elt){
	    var style=fdjtDOM.getStyle(elt);
	    return { top: fdjtDOM.parsePX(style.marginTop)||0+
		     fdjtDOM.parsePX(style.borderTop)||0+
		     fdjtDOM.parsePX(style.paddingTop)||0,
		     bottom: fdjtDOM.parsePX(style.marginBottom)||0+
		     fdjtDOM.parsePX(style.borderBottom)||0+
		     fdjtDOM.parsePX(style.paddingBottom)||0};}
	fdjtDOM.getBounds=getBounds;
	
	/* Creating the HUD */
	
	function setupTOC(root_info){
	    var navhud=createNavHUD("div#SBOOKTOC.hudpanel",root_info);
	    var toc_button=fdjtID("SBOOKTOCBUTTON");
	    toc_button.style.visibility='';
	    sbook.TOC=navhud;
	    fdjtDOM.replace("SBOOKTOC",navhud);
	    var flytoc=createStaticTOC("div#SBOOKFLYTOC",root_info);
	    sbook.Flytoc=flytoc;
	    fdjtDOM(fdjtID("FLYTOC"),flytoc);}
	sbook.setupTOC=setupTOC;

	function createNavHUD(eltspec,root_info){
	    var toc_div=sbookTOC(root_info,0,false,"SBOOKTOC4");
	    var div=fdjtDOM(eltspec||"div#SBOOKTOC.hudpanel",toc_div);
	    if (!(eltspec)) sbookNavHUD=div;
	    sbook.UI.addHandlers(div,"toc");
	    return div;}

	function createStaticTOC(eltspec,root_info){
	    var toc_div=sbookTOC(root_info,0,false,"SBOOKFLYTOC4");
	    var div=fdjtDOM(eltspec||"div#SBOOKFLYTOC",toc_div);
	    if (!(eltspec)) sbookNavHUD=div;
	    return div;}

	/* HUD animation */

	function setHUD(flag){
	    if ((!(flag))===(!(sbook.hudup))) {}
	    else if (flag) {
		sbook.hudup=true;
		fdjtDOM.addClass(document.body,"hudup");}
	    else {
		sbook.hudup=false;
		fdjtDOM.dropClass(sbookHUD,"flyleaf");
		fdjtDOM.dropClass(sbookHUD,"full");
		fdjtDOM.dropClass(sbookHUD,sbookMode_pat);
		fdjtDOM.dropClass(document.body,"hudup");}}

	/* Mode controls */
	
	var sbookMode_pat=
	    /(login)|(device)|(sbookapp)|(help)|(scanning)|(tocscan)|(searching)|(browsing)|(toc)|(glosses)|(allglosses)|(context)|(flytoc)|(about)|(console)|(minimal)|(addgloss)/g;
	var sbookFlyleafMode_pat=/(login)|(device)|(sbookapp)|(flytoc)|(about)/g;
	var sbook_mode_scrollers=
	    {allglosses: "SBOOKALLGLOSSES",
	     browsing: "SBOOKSEARCHRESULTS",
	     searching: "SBOOKSEARCHCLOUD",
	     addgloss: "SBOOKGLOSSCLOUD",
	     sbookapp: "MANAGEAPP",
	     flytoc: "SBOOKFLYTOC",
	     login: "SBOOKFLYLOGIN",
	     /* ,
		login: "SBOOKAPPLOGIN",
		device: "SBOOKDEVICE",
		about: "APPABOUT",
	     */
	    };
	
	function sbookMode(mode){
	    if (typeof mode === 'undefined') return sbook.mode;
	    if (sbook.Trace.mode)
		fdjtLog("[%fs] sbookMode %o, cur=%o dbc=%o",
			fdjtET(),mode,sbook.mode,document.body.className);
	    if ((sbook.mode==='help')&&(!(mode))) mode=sbook.last_mode;
	    if (mode) {
		if (mode==="flyleaf") mode=sbook.last_flyleaf||"about";
		if (mode!=="scanning") sbook.scanning=false;
		if (mode===sbook.mode) {}
		else if (mode===true) {
		    sbook.mode=false;
		    sbook.last_mode=true;}
		else if (typeof mode !== 'string') 
		    throw new Error('mode arg not a string');
		else if (mode==='help') {
		    // Don't save 'help' as the last mode, because
		    //  we'll return to the actual last mode when help
		    //  finishes
		    sbook.mode=mode;}
		else {
		    sbook.mode=mode;
		    sbook.last_mode=mode;}
		if ((mode==="sbookapp")&&(!(fdjtID("MANAGEAPP").src)))
		    sbookSetupFlyleaf();
		if (!(typeof mode === 'string'))
		    sbook.scrolling=false;
		else if (sbook_mode_scrollers[mode]) 
		    sbook.scrolling=(sbook_mode_scrollers[mode]);
		else sbook.scrolling=false;
		if (mode===true)
		    fdjtDOM.swapClass(sbookHUD,sbookMode_pat,"minimal");
		else fdjtDOM.swapClass(sbookHUD,sbookMode_pat,mode);
		if ((mode)&&(typeof mode === 'string')&&
		    (mode.search(sbookFlyleafMode_pat)===0)) {
		    fdjtDOM.addClass(sbookHUD,"flyleaf");
		    sbook.last_flyleaf=mode;}
		else fdjtDOM.dropClass(sbookHUD,"flyleaf");
		if (mode==="help")
		    fdjtDOM.addClass(document.body,"dimmed");
		else fdjtDOM.dropClass(document.body,"dimmed");
		setHUD(true);
		if ((mode==="allglosses")&&
		    (sbook.curinfo)&&(sbook.curinfo.first)) {
		    sbook.UI.scrollGlosses
		    (sbook.curinfo.first,fdjtID("SBOOKALLGLOSSES"));}
		if (mode==="searching")
		    fdjtID("SBOOKSEARCHINPUT").focus();
		else document.body.focus();
		if (sbook.scrolling)
		    updateScroller(fdjtID(sbook.scrolling));
		sbook.displaySync();}
	    else {
		if (sbook.mode!=='help') sbook.last_mode=sbook.mode;
		document.body.focus();
		fdjtDOM.dropClass(document.body,"dimmed");
		sbook.mode=false; sbook.scrolling=false;
		setHUD(false);
		sbook.displaySync();}}

	function fadeUpHUD(){
	    fdjtLog("Setting properties");
	    sbookHUD.style.opacity=0.001;
	    setTimeout(function(){
		fdjtLog("Changing opacity");
		sbookHUD.style.opacity=1.00;
		setTimeout(function(){
		    fdjtLog("Clearing setup");
		    sbookHUD.style.opacity='';},
			   1500);},
		       1500);}
	sbook.fadeUpHUD=fadeUpHUD;

	function updateScroller(elt){
	    if (typeof elt === 'string') elt=fdjtID(elt);
	    var c=elt.parentNode; var cc=c.parentNode;
	    var cstyle=fdjtDOM.getStyle(c);
	    var ccstyle=fdjtDOM.getStyle(cc);
	    var cbounds=fdjtDOM.parsePX(cstyle.borderTopWidth)+fdjtDOM.parsePX(cstyle.borderBottomWidth)+
		fdjtDOM.parsePX(cstyle.paddingTop)+fdjtDOM.parsePX(cstyle.paddingBottom)+
		fdjtDOM.parsePX(cstyle.marginTop)+fdjtDOM.parsePX(cstyle.marginBottom);
	    var ccbounds=fdjtDOM.parsePX(ccstyle.borderTopWidth)+fdjtDOM.parsePX(ccstyle.borderBottomWidth)+
		fdjtDOM.parsePX(ccstyle.paddingTop)+fdjtDOM.parsePX(ccstyle.paddingBottom)+
		fdjtDOM.parsePX(ccstyle.marginTop)+fdjtDOM.parsePX(ccstyle.marginBottom);
	    if (sbook.nativescroll) {
		c.style.height=
		    ((cc.offsetHeight-(ccbounds+cbounds))-c.offsetTop)+'px';}
	    else {
		if ((!(sbook.scrollers))||(!(elt.id))) return;
		if (sbook.Trace.scroll) {
		    fdjtLog("[%fs] cco=%o ct=%o nh=%o",
			    fdjtET(),cc.offsetHeight,c.offsetTop,
			    cc.offsetHeight-c.offsetTop);}
		c.style.height=''; c.style.overflow='visible';
		c.style.height=((cc.offsetHeight-(ccbounds+cbounds))-c.offsetTop)+'px';
		c.style.overflow='hidden';
		if ((sbook.scrollers[elt.id])&&
		    (sbook.scrollers[elt.id].element===elt))
		    sbook.scrollers[elt.id].refresh();
		else sbook.scrollers[elt.id]=new iScroll(elt);}
	    if (sbook.Trace.scroll) {
		fdjtLog("[%fs] updateScroller %o %o %o ch=%o h=%o",
			fdjtET(),elt,c,cc,cc.offsetHeight-c.offsetTop,elt.offsetHeight);
		fdjtLog("[%fs] updateScroller e=%o,c=%o,cc=%o",
			fdjtET(),fdjtDOM.getStyle(elt).overflow,
			fdjtDOM.getStyle(c).overflow,
			fdjtDOM.getStyle(cc).overflow);
		if ((!(sbook.nativescroll))&&
		    (elt.id)&&(sbook.scrollers)&&
		    (sbook.scrollers[elt.id])) {
		    var scroller=sbook.scrollers[elt.id];
		    fdjtLog("[%fs] e=%o w=%o wo=%o,%o wc=%o,%o i=%o,%o o=%o,%o d=%o,%o m=%o,%o",
			    fdjtET(),scroller.element,scroller.wrapper,
			    scroller.wrapper.offsetWidth,scroller.wrapper.offsetHeight,
			    scroller.wrapper.clientWidth,scroller.wrapper.clientHeight,
			    elt.offsetWidth,elt.offsetHeight,
			    scroller.scrollerWidth,scroller.scrollerHeight,
			    scroller.scrollWidth,scroller.scrollHeight,
			    scroller.maxScrollX,scroller.maxScrollY);}}}
	sbook.UI.updateScroller=updateScroller;

	function sbookHUDToggle(mode){
	    if (!(sbook.mode)) sbookMode(mode);
	    else if (mode===sbook.mode) sbookMode(false);
	    else sbookMode(mode);}
	sbookMode.toggle=sbookHUDToggle;

	sbook.dropHUD=function(){return sbookMode(false);}
	sbook.toggleHUD=function(evt){
	    if (fdjtDOM.isClickable(fdjtUI.T(evt))) return;
	    if (sbook.mode) sbookMode(false);
	    else sbookMode(true);};
	
	/* HUD Messages */
	
	var sbook_message_timer=false;
	
	function sbookMessage(message){
	    var msg=fdjtDOM("div.message",
			    fdjtDOM("span.head",message),
			    fdjtState.argVec(arguments,1));
	    fdjtDOM.replace("SBOOKHELPMESSAGE",fdjtDOM.clone(msg));
	    fdjtDOM.replace("SBOOKCONSOLEMESSAGE",fdjtDOM.clone(msg));
	    fdjtDOM.prepend("SBOOKMESSAGELOG",
			    fdjtDOM("div.logentry",
				    fdjtDOM("span.time",fdjtET()),
				    message,
				    fdjtState.argVec(arguments,1)));}
	sbook.Message=sbookMessage;

	function sbookFlashMessage(arg0){
	    var duration=message_timeout; var message; var args;
	    if (!(arg0)) message=false;
	    else if (typeof arg0 === 'number') {
		if (arg0<0) duration=message_timeout;
		else if (arg0<50) duration=arg0*1000;
		else duration=arg0;
		message=arguments[1];
		args=fdjtState.argVec(arguments,2);}
	    else {
		duration=message_timeout; message=arg0;
		args=fdjtState.argVec(arguments,1);}
	    if (sbook_message_timer) clearTimeout(sbook_message_timer);
	    if (message) {
		fdjtDOM.replace("SBOOKMESSAGE",
				fdjtDOM("div.message",fdjtDOM("div.head",message),args));
		fdjtDOM.prepend("SBOOKMESSAGELOG",
				fdjtDOM("div.logentry",
					fdjtDOM("span.time",fdjtET()),
					message));}
	    if (!((sbook.mode==='console')||(sbook.mode==='help')||
		  (sbook.mode==='message'))) { 
		fdjtDOM.dropClass(sbookHUD,sbookMode_pat);
		fdjtDOM.addClass(sbookHUD,"console");
		var mode=sbook.mode;
		sbook_message_timer=
		    setTimeout(function() {
			if (mode==="console") sbookMode(false);
			else if (sbook.mode==="console") sbookMode(false);	
			else if (mode) {
			    fdjtDOM.swapClass(sbookHUD,"console",mode);}},
			       duration);}}
	sbook.Flash=sbookFlashMessage;

	function sbookGetStableId(elt){
	    var info=sbook.Info(elt);
	    // fdjtLog("Scrolling to %o with id %s/%s",target,info.frag,target.id);
	    if ((info) && (info.frag) && (!(info.frag.search(/TMPID/)==0)))
		return info.frag;
	    else if ((elt.id) && (!(elt.id.search(/TMPID/)==0)))
		return elt.id;
	    else return false;}


	/* The App HUD */
	
	function fillinFlyleaf(){
	    var hidehelp=fdjtID("SBOOKHIDEHELP");
	    var dohidehelp=fdjtState.getCookie("sbookhidehelp");
	    if (!(hidehelp)) {}
	    else if (dohidehelp==='no') hidehelp.checked=false;
	    else if (dohidehelp) hidehelp.checked=true;
	    else hidehelp.checked=false;
	    if (hidehelp)
		hidehelp.onchange=function(evt){
		    if (hidehelp.checked)
			fdjtState.setCookie("sbookhidehelp",true,false,"/");
		    else fdjtState.setCookie("sbookhidehelp","no",false,"/");};
	    var refuris=document.getElementsByName("REFURI");
	    if (refuris) {
		var i=0; var len=refuris.length;
		while (i<len)
		    if (refuris[i].value==='fillin')
			refuris[i++].value=sbook.refuri;
		else i++;}
	    fillinAboutInfo();
	    /* Get various external APPLINK uris */
	    var offlineuri=fdjtDOM.getLink("sbook.offline")||altLink("offline");
	    var epuburi=fdjtDOM.getLink("sbook.epub")||altLink("ebub");
	    var mobiuri=fdjtDOM.getLink("sbook.mobi")||altLink("mobi");
	    var zipuri=fdjtDOM.getLink("sbook.mobi")||altLink("mobi");
	    if (offlineuri) {
		var elts=document.getElementsByName("SBOOKOFFLINELINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (offlineuri!=='none') elt.href=offlineuri;
		    else {
			elt.href=false;
			fdjtDOM.addClass(elt,"deadlink");
			elt.title='this sBook is not available offline';}}}
	    if (epuburi) {
		var elts=document.getElementsByName("SBOOKEPUBLINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (epuburi!=='none') elt.href=epuburi;
		    else {
			elt.href=false;
			fdjtDOM.addClass(elt,"deadlink");
			elt.title='this sBook is not available as an ePub';}}}
	    if (mobiuri) {
		var elts=document.getElementsByName("SBOOKMOBILINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (mobiuri!=='none') elt.href=mobiuri;
		    else {
			elt.href=false;
			fdjtDOM.addClass(elt,"deadlink");
			elt.title='this sBook is not available as a MOBIpocket format eBook';}}}
	    if (zipuri) {
		var elts=document.getElementsByName("SBOOKZIPLINK");
		var i=0; while (i<elts.length) {
		    var elt=elts[i++];
		    if (zipuri!=='none') elt.href=zipuri;
		    else {
			elt.href=false;
			fdjtDOM.addClass(elt,"deadlink");
			elt.title='this sBook is not available as a ZIP bundle';}}}
	    initManageIFrame();
	    /* If the book is offline, don't bother showing the link to the offline
	       version. */
	    if (sbook.offline) fdjtDOM.addClass(document.body,"sbookoffline");}

	function altLink(type,uri){
	    uri=uri||sbook.refuri;
	    if (uri.search("http://")===0)
		return "http://offline."+uri.slice(7);
	    else if (uri.search("https://")===0)
		return "https://offline."+uri.slice(8);
	    else return false;}

	function _sbookFillTemplate(template,spec,content){
	    if (!(content)) return;
	    var elt=fdjtDOM.$(spec,template);
	    if ((elt)&&(elt.length>0)) elt=elt[0];
	    else return;
	    if (typeof content === 'string')
	      elt.innerHTML=content;
	    else if (content.cloneNode)
		fdjtDOM.replace(elt,content.cloneNode(true));
	    else fdjtDOM(elt,content);}

	function fillinAboutInfo(){
	    if (fdjtID("SBOOKABOUT")) {
		fdjtDOM.replace("APPABOUTCONTENT",fdjtID("SBOOKABOUT"));
		return;}
	    var about=fdjtID("APPABOUT");
	    var title=
		fdjtID("SBOOKTITLE")||
		fdjtDOM.getMeta("sbook.title")||
		fdjtDOM.getMeta("TITLE")||
		fdjtDOM.getMeta("DC.title")||
		document.title;
	    var byline=
		fdjtID("SBOOKBYLINE")||fdjtID("SBOOKAUTHOR")||
		fdjtDOM.getMeta("sbook.byline")||fdjtDOM.getMeta("BYLINE")||
		fdjtDOM.getMeta("sbook.author")||fdjtDOM.getMeta("AUTHOR");
	    var copyright=
		fdjtID("SBOOKCOPYRIGHT")||
		fdjtDOM.getMeta("sbook.copyright")||fdjtDOM.getMeta("COPYRIGHT")||
		fdjtDOM.getMeta("RIGHTS");
	    var publisher=
		fdjtID("SBOOKPUBLISHER")||
		fdjtDOM.getMeta("sbook.publisher")||
		fdjtDOM.getMeta("PUBLISHER");
	    var description=
		fdjtID("SBOOKDESCRIPTION")||
		fdjtDOM.getMeta("sbook.description")||
		fdjtDOM.getMeta("DESCRIPTION");
	    var digitized=
		fdjtID("SBOOKDIGITIZED")||
		fdjtDOM.getMeta("sbook.digitized")||
		fdjtDOM.getMeta("DIGITIZED");
	    var sbookified=fdjtID("SBOOKIFIED")||fdjtDOM.getMeta("SBOOKIFIED");
	    _sbookFillTemplate(about,".title",title);
	    _sbookFillTemplate(about,".byline",byline);
	    _sbookFillTemplate(about,".publisher",publisher);
	    _sbookFillTemplate(about,".copyright",copyright);
	    _sbookFillTemplate(about,".description",description);
	    _sbookFillTemplate(about,".digitized",digitized);
	    _sbookFillTemplate(about,".sbookified",sbookified);
	    _sbookFillTemplate(about,".about",fdjtID("SBOOKABOUT"));
	    var cover=fdjtDOM.getLink("cover");
	    if (cover) {
		var cover_elt=fdjtDOM.$(".cover",about)[0];
		if (cover_elt) fdjtDOM(cover_elt,fdjtDOM.Image(cover));}}

	function initManageIFrame(){
	    var query=document.location.search||"?";
	    var refuri=sbook.refuri;
	    var appuri="https://"+sbook.server+"/v4/flyleaf"+query;
	    if (query.search("REFURI=")<0)
		appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
	    if (query.search("TOPURI=")<0)
		appuri=appuri+"&TOPURI="+
		encodeURIComponent(document.location.href);
	    if (document.title) {
		appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
	    fdjtID("MANAGEAPP").src=appuri;}

	sbookMode.selectApp=function(){
	    if (sbook.mode==='sbookapp') initManageIFrame();
	    else sbookMode('sbookapp');}

	/* Scanning */

	function sbookScan(elt,src){
	    var cxt=false;
	    var body=document.body;
	    var pelt=sbook.scanning;
	    if (sbook.Trace.mode)
		fdjtLog("[%fs] sbookScan() %o (src=%o) mode=%o scn=%o/%o",
			fdjtET(),elt,src,sbook.mode,sbook.scanning,sbook.target);
	    // Save the source HUD element for the preview (when provided)
	    if (sbook.scanning!==src) {
		var clone=src.cloneNode(true);
		clone.id="SBOOKSCAN";
		fdjtDOM.replace("SBOOKSCAN",clone);
		sbook.scanning=src;}
	    else {}
	    sbook.setTarget(elt);
	    sbook.GoTo(elt);
	    sbookMode("scanning");}
	sbook.Scan=sbookScan;

	/* Button methods */

	function LoginButton_onclick(evt){
	    evt=evt||event||null;
	    if (sbook.mode==="login") sbookMode(false);
	    else sbookMode("login");
	    evt.cancelBubble=true;}

	return sbookMode;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
