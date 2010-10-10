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
	var sbookFlyleaf=false; var box_top=false; var box_bottom=false;
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
	    var dash=fdjtID("SBOOKDASH");
	    dash.innerHTML=sbook_dashtext;
	    var gloss=fdjtID("SBOOKADDGLOSS");
	    gloss.innerHTML=sbook_addgloss;
	    fdjtUI.AutoPrompt.setup(gloss);
	    var dashtop=fdjtID("SBOOKDASHTOP");
	    dashtop.innerHTML=sbook_dashtop;
	    // Initialize search UI
	    var search=fdjtID("SBOOKSEARCH");
	    search.innerHTML=sbook_searchbox;
	    fdjtUI.AutoPrompt.setup(search);
	    sbook.empty_cloud=
		new fdjtUI.Completions(fdjtID("SBOOKSEARCHCLOUD"));

	    if (sbook.hidehelp) sbook.setConfig("hidehelp");

	    // Initialize gloss UI
	    var glosses=fdjtID("SBOOKALLGLOSSES");
	    sbook.UI.setupSummaryDiv(glosses);
	    sbook.glosses.addEffect("user",function(f,p,v){
		sbook.sourcekb.ref(v).oninit(sbook.UI.addGlossSource,"newsource");});
	    sbook.glosses.addEffect("distribution",function(f,p,v){
		sbook.sourcekb.ref(v).oninit(sbook.UI.addGlossSource,"newsource");});

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
		if (tag instanceof Array) {
		    var i=0; var lim=tag.length;
		    while (i<lim) addTag2UI(tag[i++],forsearch||false);
		    return;}
		else {
		    var gloss_cloud=sbook.glossCloud();
		    var search_cloud=sbook.FullCloud();
		    var gloss_tag=gloss_cloud.getByValue(tag,".completion");
		    var search_tag=((forsearch)&&(search_cloud.getByValue(tag,".completion")));
		    if (!((gloss_tag)&&(gloss_tag.length))) {
			gloss_tag=Knodule.HTML(tag,sbook.knodule,false,true);
			gloss_cloud.addCompletion(gloss_tag);}
		    if ((forsearch)&&(!((search_tag)&&(search_tag.length)))) {
			search_tag=Knodule.HTML(tag,sbook.knodule,false,true);
			search_cloud.addCompletion(search_tag);}}}
	    sbook.addTag2UI=addTag2UI;
	    
	    sbookFoot=fdjtID("SBOOKFOOT");
	    sbookHead=fdjtID("SBOOKHEAD");
	    sbookHelp=fdjtID("SBOOKHELP");
	    sbookFlyleaf=fdjtID("SBOOKFLYLEAF");
	    fillinDash();
	    resizeHUD();
	    if (sbook.scrollfree) {
		sbook.scrollers={};
		var content=sbookFlyleaf.childNodes;
		var i=0; var lim=content.length;
		while (i<lim) {
		    if ((content[i].nodeType===1)&&(content[i].id)) {
			var elt=content[i++];
			sbook.scrollers[elt.id]=new iScroll(elt);}
		    else i++;}
		fdjtDOM.addListener(window,"resize",resizeHUD);}}
	sbook.initHUD=initHUD;
	
	function resizeHUD(){
	  var vh=fdjtDOM.viewHeight();
	  var vw=fdjtDOM.viewWidth();
	  var hf=fdjtID("SBOOKFOOT");
	  var flyleaf=fdjtID("SBOOKFLYLEAF");
	  var fh=fdjtDOM.getGeometry(hf).height;
          // fdjtLog("[%fs] resizeHUD vh=%o vw=%o fh=%o",fdjtET(),vh,vw,fh);
	  flyleaf.style.maxHeight=(vh-100)+'px';
	    if (sbook.scrollfree) hf.style.top=(vh-fh)+'px';}

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
	    var dashtoc=createStaticTOC("div#SBOOKDASHTOC",root_info);
	    sbook.DashTOC=dashtoc;
	    fdjtDOM(fdjtID("DASHTOC"),dashtoc);}
	sbook.setupTOC=setupTOC;

	function createNavHUD(eltspec,root_info){
	    var toc_div=sbookTOC(root_info,0,false,"SBOOKTOC4");
	    var div=fdjtDOM(eltspec||"div#SBOOKTOC.hudpanel",toc_div);
	    if (!(eltspec)) sbookNavHUD=div;
	    sbook.UI.addHandlers(div,"toc");
	    return div;}

	function createStaticTOC(eltspec,root_info){
	    var toc_div=sbookTOC(root_info,0,false,"SBOOKDASHTOC4");
	    var div=fdjtDOM(eltspec||"div#SBOOKDASHTOC",toc_div);
	    if (!(eltspec)) sbookNavHUD=div;
	    // The dash TOC doesn't do fancy mouseovers
	    // sbook.UI.addHandlers(div,"toc");
	    return div;}

	/* Mode controls */
	
	var sbookMode_pat=
	    /(login)|(device)|(sbookapp)|(help)|(searching)|(browsing)|(toc)|(glosses)|(allglosses)|(context)|(dashtoc)|(about)|(console)|(minimal)|(target)/g;
	var sbookDashMode_pat=/(login)|(device)|(sbookapp)|(dashtoc)|(about)/g;
	
	function sbookMode(mode){
	    if (typeof mode === 'undefined') return sbook.mode;
	    if (sbook.Trace.mode)
		fdjtLog("[%fs] sbookMode %o, cur=%o dbc=%o",
			fdjtET(),mode,sbook.mode,document.body.className);
	    if (sbook.preview) sbook.Preview(false);
	    if ((sbook.mode==='help')&&(!(mode))) mode=sbook.last_mode;
	    if (mode) {
		if (mode==="dash") mode=sbook.last_dash||"about";
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
		    sbookSetupDash();
		if (!(typeof mode === 'string'))
		    sbook.scrolling=false;
		else if (mode==='allglosses') 
		    sbook.scrolling="SBOOKALLGLOSSES";
		else if (mode==='browsing')
		    sbook.scrolling="SBOOKSEARCHRESULTS";
		else if (mode==='searching')
		    sbook.scrolling="SBOOKSEARCHCLOUD";
		else if (mode==='target')
		    sbook.scrolling="SBOOKGLOSSCLOUD";
		else sbook.scrolling=false;
		if ((mode)&&(typeof mode === 'string')&&
		    (mode.search(sbookDashMode_pat)===0)) {
		  fdjtDOM.addClass(sbookHUD,"dash");
		  sbook.scrolling="SBOOKDASH";
		  sbook.last_dash=mode;}
		else fdjtDOM.dropClass(sbookHUD,"dash");
		sbook.hudup=true;
		if ((mode===true)&&(sbook.animate)) {
		    sbookHUD.opacity=1;
		    setTimeout(function(){
			fdjtDOM.addClass(document.body,"hudup");},
			       1000);}
		else fdjtDOM.addClass(document.body,"hudup");
		if (mode===true) fdjtDOM.swapClass(sbookHUD,sbookMode_pat,"minimal");
		else fdjtDOM.swapClass(sbookHUD,sbookMode_pat,mode);
		if (mode==="help")
		    fdjtDOM.addClass(document.body,"dimmed");
		else fdjtDOM.dropClass(document.body,"dimmed");
		if ((mode==="allglosses")&&
		    (sbook.curinfo)&&(sbook.curinfo.first)) {
		    sbook.UI.scrollGlosses
		    (sbook.curinfo.first,fdjtID("SBOOKALLGLOSSES"));}
		if (mode==="searching")
		    fdjtID("SBOOKSEARCHINPUT").focus();
		else document.body.focus();
		if (sbook.scrolling) updateScroller(fdjtID(sbook.scrolling));
		sbook.displaySync();}
	    else {
		if (sbook.mode!=='help') sbook.last_mode=sbook.mode;
		document.body.focus();
		fdjtDOM.dropClass(document.body,"dimmed");
		fdjtDOM.dropClass(sbookHUD,"dash");
		fdjtDOM.dropClass(sbookHUD,"full");
		sbook.mode=false; sbook.hudup=false; sbook.scrolling=false;
		if ((sbook.animate)) {
		    sbookHUD.style.opacity=0;
		    setTimeout(function(){
			fdjtDOM.dropClass(document.body,"hudup");
			fdjtDOM.dropClass(sbookHUD,sbookMode_pat);
			sbook.displaySync();
			sbookHUD.style.opacity=1;},
			       1000);}
		else {
		    fdjtDOM.dropClass(document.body,"hudup");
		    fdjtDOM.dropClass(sbookHUD,sbookMode_pat);
		    sbook.displaySync();}}}

	function updateScroller(elt){
	    if ((!(sbook.scrollers))||(!(elt.id))) return;
	    else if (sbook.scrollers[elt.id].element===elt)
		sbook.scrollers[elt.id].refresh();
	    else sbook.scrollers[elt.id]=new iScroll(elt);}
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
	
	function fillinDash(){
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
	    fdjtUI.AutoPrompt.setup(fdjtID("SBOOKDASH"));
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
	    var appuri="https://"+sbook.server+"/v4/manage.fdcgi"+query;
	    if (query.search("REFURI=")<0)
		appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
	    if (query.search("DOCURI=")<0)
		appuri=appuri+"&DOCURI="+encodeURIComponent(sbook.docuri);
	    if (document.title) {
		appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
	    fdjtID("MANAGEAPP").src=appuri;}


	/* Previewing */
	
	var sbook_preview_delay=250;
	// This can be a regular expression
	var sbook_preview_classes=/(sbooknote)/;
	
	function sbookPreview(elt,src){
	    var cxt=false;
	    var body=document.body;
	    var pelt=sbook.previewelt;
	    if (sbook.Trace.mode)
		fdjtLog("[%fs] sbookPreview() %o (src=%o) mode=%o sbp=%o pe=%o sbpt=%o target=%o",
			fdjtET(),elt,src,sbook.mode,
			sbook.preview,sbook.previewelt,sbook.preview_target,
			sbook.target);
	    
	    // Save the source HUD element for the preview (when provided)
	    if (src) {
		if (sbook.previewelt!==src) {
		    if (fdjtDOM.hasClass(src,sbook_preview_classes)) {
			var clone=src.cloneNode(true);
			clone.id="SBOOKPREVIEW";
			fdjtDOM.addClass(clone,"hudpanel");
			fdjtDOM.replace("SBOOKPREVIEW",clone);}
		    else fdjtDOM.replace("SBOOKPREVIEW",
					 fdjtDOM("div#SBOOKPREVIEW"));
		    sbook.previewelt=src;}
		else {}}
	    else if (sbook.previewelt) {
		fdjtDOM.dropClass(sbook.previewelt,"previewed");
		sbook.previewelt=false;}
	    else {}
	    if ((sbook.preview)&&(sbook.preview!==elt)) {
		var scan=sbook.preview;
		// Clear the 'preview' class on the parents
		while (scan)
		    if (scan===body) break;
		else {
		    fdjtDOM.dropClass(scan,"preview");
		    scan=scan.parentNode;}
		// Update the element itself, 
		if (sbook.preview.sbooktitle) {
		    sbook.preview.title=sbook.preview.sbooktitle;}
		fdjtDOM.dropClass(sbook.preview,"previewing");}
	    if (!(elt)) {
		fdjtDOM.dropClass(body,"preview");
		// Restore the scroll position
		sbook.scrollRestore();
		// Set the state
		sbook.preview_target=false;
		sbook.preview=false;
		// Scroll the past preview element context
		// We can't do this earlier because it's not displayed
		//  and so has no geometry
		// if ((pelt)&&(sbook.previewstart!==pelt)&&(pelt.scrollIntoView))
		if ((sbook.scrollers)&&(pelt)&&(sbook.scrolling)&&
		    (sbook.scrollers[sbook.scrolling])&&
		    (fdjtDOM.hasParent(pelt,fdjtID(sbook.scrolling)))) {
		    var scroller=sbook.scrollers[sbook.scrolling];
		    scroller.scrollToElement(pelt);}
		else if (pelt) pelt.scrollIntoView();
		sbook.previewstart=false;
		fdjtDOM.replace("SBOOKPREVIEW",fdjtDOM("div#SBOOKPREVIEW"));
		return;}
	    else if ((elt===sbook.root)||(elt===document.body))
		return;

	    /* Update the preview element in its slice. */
	    if (src) {
		fdjtDOM.addClass(src,"previewed");
		if (!(sbook.previewstart)) sbook.previewstart=src;
		if ((pelt)&&(pelt!==src)&&(src.scrollIntoView))
		    src.scrollIntoView();}
	    
	    fdjtDOM.addClass(body,"preview");
	    var scan=elt;
	    while (scan) if (scan===body) break;
	    else {
		fdjtDOM.addClass(scan,"preview");
		scan=scan.parentNode;}
	    fdjtDOM.addClass(elt,"previewing");
	    sbook.last_preview=elt;
	    sbook.preview_target=sbook.preview=elt;
	    if ((!(elt.sbooktitle))&&(elt.title)&&
		(elt.title!=='click to jump to this passage'))
		elt.sbooktitle=elt.title;
	    elt.title='click to jump to this passage';
	    if ((elt.getAttribute) &&
		(elt.getAttribute("toclevel")) ||
		((elt.sbookinfo) && (elt.sbookinfo.level)))
		cxt=false;
	    else if (elt.head)
		cxt=elt.head;
	    sbook.scrollPreview(elt,cxt,displayOffset());}

	sbook.Preview=sbookPreview;

	function displayOffset(){
	    return -(Math.floor(fdjtDOM.viewHeight()/2));}

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
