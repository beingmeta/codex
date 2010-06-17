/* -*- Mode: Javascript; -*- */

var sbooks_hud_id="$Id$";
var sbooks_hud_version=parseInt("$Revision$".slice(10,-1));

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

var sbookMode=
    (function(){
	// This is the regex for all sbook apps
	var sbook_apps=["help","login","sbookapp","device","dashtoc","about"];
	
	// The foot HUD
	var sbookFoot=false;
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
		sbookHUD.innerHTML=sbook_hudtext;
		fdjtDOM.prepend(document.body,sbookHUD);}
	    var console=fdjtID("SBOOKCONSOLE");
	    console.innerHTML=sbook_consoletext;
	    var dash=fdjtID("SBOOKDASH");
	    dash.innerHTML=sbook_dashtext.replace('%HELPTEXT',sbook_helptext);
	    var search=fdjtID("SBOOKSEARCH");
	    search.innerHTML=sbook_searchtext;
	    initSearch(search);
	    var glosses=fdjtID("SBOOKALLSUMMARIES");
	    sbookUI.setupSummaryDiv(glosses);
	    sbook.glosses.addEffect("user",function(f,p,v){
		sbook.sourcekb.ref(v).oninit(sbookUI.addSourceIcon);});
	    sbook.glosses.addEffect("distribution",function(f,p,v){
		sbook.sourcekb.ref(v).oninit(sbookUI.addSourceIcon);});
	    sbook.glosses.addInit(function(item){
		sbookUI.addSummary(item,glosses,false);
		var glossmark=sbookUI.addGlossmark(item.frag); {
		    if (item.tstamp>sbook.syncstamp) sbook.syncstamp=item.tstamp;
		    var pic=((fdjtKB.ref(item.user)).pic)||
			((fdjtKB.ref(item.feed)).pic);
		    if (pic) {
			var img=fdjtDOM.getFirstChild(glossmark,"IMG.big");
			if (img) img.src=pic;}}});
	    sbookFoot=fdjtID("SBOOKFOOT");
	    var bookmark=fdjtID("SBOOKMARKHUD");
	    bookmark.innerHTML=sbook_addgloss_html;
	    fillinDash();}
	sbook.initHUD=initHUD;
	
	/* Creating the HUD */
	
	function setupTOC(root_info){
	    var navhud=createNavHUD("div#SBOOKTOC.hudblock",root_info);
	    var toc_button=fdjtID("SBOOKTOCBUTTON");
	    toc_button.style.visibility='';
	    fdjtDOM.replace("SBOOKTOC",navhud);
	    fdjtDOM(fdjtID("DASHTOC"),
		    createStaticTOC("div#SBOOKDASHTOC",root_info));}
	sbook.setupTOC=setupTOC;

	function createNavHUD(eltspec,root_info){
	    var toc_div=sbookTOC(root_info,0,false,"SBOOKTOC4");
	    var div=fdjtDOM(eltspec||"div#SBOOKTOC.hudblock.hud",toc_div);
	    if (!(eltspec)) sbookNavHUD=div;
	    if (sbook.mouse) {
		fdjtDOM.addListener(div,"mouseover",sbookTOC.onmouseover);
		fdjtDOM.addListener(div,"mouseout",sbookTOC.onmouseout);
		fdjtDOM.addListener(div,"mousedown",sbookTOC.onmousedown);
		fdjtDOM.addListener(div,"mouseup",sbookTOC.onmouseup);
		fdjtDOM.addListener(div,"click",sbookTOC.onclick);}
	    else fdjtDOM.addListener(div,"click",sbookTOC.oneclick);
	    return div;}

	function createStaticTOC(eltspec,root_info){
	    var toc_div=sbookTOC(root_info,0,false,"SBOOKDASHTOC4");
	    var div=fdjtDOM(eltspec||"div#SBOOKDASHTOC",toc_div);
	    if (!(eltspec)) sbookNavHUD=div;
	    if (sbook.mouse) {
		fdjtDOM.addListener(div,"mouseover",sbookTOC.onmouseover);
		fdjtDOM.addListener(div,"mouseout",sbookTOC.onmouseout);
		fdjtDOM.addListener(div,"mousedown",sbookTOC.onmousedown);
		fdjtDOM.addListener(div,"mouseup",sbookTOC.onmouseup);
		fdjtDOM.addListener(div,"click",sbookTOC.onholdclick);}
	    else fdjtDOM.addListener(div,"click",sbookTOC.oneclick);
	    return div;}

	function initSearch(){
	    var input=fdjtID("SBOOKSEARCHTEXT");
	    fdjtDOM.addListener(input,"keypress",
				sbookUI.handlers.SearchInput_onkeypress);
	    fdjtDOM.addListener(input,"keyup",
				sbookUI.handlers.SearchInput_onkeyup);
	    fdjtDOM.addListener(input,"focus",
				sbookUI.handlers.SearchInput_onfocus);
	    fdjtDOM.addListener(input,"blur",
				sbookUI.handlers.SearchInput_onblur);

	    var sbooksearch=fdjtID("SBOOKSEARCH");
	    fdjtUI.AutoPrompt.setup(sbooksearch);

	    var completions=fdjtID("SBOOKSEARCHCLOUD");
	    sbook.empty_cloud=new fdjtUI.Completions(completions);}

	/* Mode controls */
	
	var sbookHUD_displaypat=/(hudup)|(hudresults)|(hudglosses)/g;
	var sbookMode_pat=
	    /(login)|(device)|(sbookapp)|(help)|(searching)|(browsing)|(toc)|(glosses)|(allglosses)|(mark)|(context)|(dashtoc)|(about)|(console)/g;
	
	var sbook_footmodes=
	    ["login","device","sbookapp","help","dashtoc","about","allglosses","console"];
	var sbook_headmodes=["toc","searching","browsing"];
	
	var sbook_last_headmode="toc";
	var sbook_last_footmode="help";
	
	function sbookMode(mode){
	    if (typeof mode === 'undefined') return sbook.mode;
	    if (sbook.Trace.mode)
		fdjtLog("[%fs] sbookMode %o, cur=%o dbc=%o",
			fdjtET(),mode,sbook.mode,document.body.className);
	    if (sbook.preview) sbook.Preview(false);
	    if (mode) {
		if (mode==="dash") mode=sbook.last_dash||"help";
		if (sbook.floathud) syncHUD();
		if (mode===sbook.mode) {}
		else if (mode===true)  {
		    sbook.hudup=true;
		    fdjtDOM.addClass(document.body,"hudup");}
		else {
		    if (typeof mode !== 'string') 
			throw new Error('mode arg not a string');
		    if ((mode==="sbookapp")&&(!(fdjtID("MANAGEAPP").src)))
			sbookSetupDash();
		    sbook.mode=mode;
		    sbook.last_mode=mode;
		    if (fdjtKB.contains(sbook_apps,mode)) sbook.last_dash=mode;
		    fdjtDOM.addClass(document.body,"hudup"); sbook.hudup=true;
		    fdjtDOM.swapClass(sbookHUD,sbookMode_pat,mode);
		    if ((mode==="allglosses")&&(sbook.target))
			sbookUI.scrollGlosses(sbook.target);}}
	    else {
		sbook.last_mode=sbook.mode;
		sbook.mode=false; sbook.hudup=false;
		fdjtDOM.dropClass(document.body,"hudup");
		fdjtDOM.dropClass(sbookHUD,sbookMode_pat);}}

	function sbookHUDToggle(mode){
	    if (!(sbook.mode)) sbookMode(mode);
	    else if (fdjtKB.contains(arguments,sbook.mode))
		sbookMode(false);
	    else sbookMode(mode);}
	function sbookHUDFlash(mode,usecs){
	    if (mode) {
		fdjtDOM.swapClass(sbookHUD,sbookMode_pat,mode);
		fdjtDOM.addClass(document.body,"hudup"); sbook.hudup=true;
		if (usecs) fdjtUI.Delay(usecs,"flash",sbookHUDFlash);}
	    else if (usecs)
		fdjtUI.Delay(usecs,"flash",sbookHUDFlash);
	    else if (sbook.mode)
		fdjtDOM.swapClass(sbookHUD,sbookMode_pat,sbook.mode);
	    else {
		fdjtDOM.dropClass(sbookHUD,sbookMode_pat);
		fdjtDOM.dropClass(document.body,"hudup");
		sbook.hudup=false;}}
	sbookMode.toggle=sbookHUDToggle;
	sbookMode.flash=sbookHUDFlash;

	sbook.dropHUD=function(){return sbookMode(false);}
	sbook.toggleHUD=function(evt){
	    if (fdjtDOM.isClickable(fdjtUI.T(evt))) return;
	    if (sbook.mode) sbookMode(false);
	    else sbookMode(true);};
	
	/* HUD Messages */
	
	var sbook_message_timer=false;
	
	function sbookMessage(message){
	    fdjtDOM.replace("SBOOKMESSAGE",
			    fdjtDOM("div.message",
				    fdjtDOM("div.head",message),
				    fdjtState.argVec(arguments,1)));
	    fdjtDOM.prepend("SBOOKMESSAGELOG",
			    fdjtDOM("div.logentry",
				    fdjtDOM("span.time",fdjtET()),
				    message));
	    sbookMode("console");}
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
	    fdjtDOM.dropClass(sbookHUD,sbookMode_pat);
	    fdjtDOM.addClass(sbookHUD,"console");
	    var mode=sbook.mode;
	    sbook_message_timer=
		setTimeout(function() {
		    if (mode==="console") sbookMode(false);
		    else if (sbook.mode==="console") sbookMode(false);	
		    else if (mode) {
			fdjtDOM.swapClass(sbookHUD,"console",mode);}},
			   duration);}
	sbook.Flash=sbookFlashMessage;

	function sbookGetStableId(elt){
	    var info=sbook.Info(elt);
	    // fdjtLog("Scrolling to %o with id %s/%s",target,info.frag,target.id);
	    if ((info) && (info.frag) && (!(info.frag.search(/TMPID/)==0)))
		return info.frag;
	    else if ((elt.id) && (!(elt.id.search(/TMPID/)==0)))
		return elt.id;
	    else return false;}

	var sbook_sync_off=false;
	var sbook_sync_height=false;
	
	function syncHUD(){
	    if (!(sbook.floathud)) return;
	    var view_top=fdjtDOM.viewTop();
	    var view_height=((sbook.mode)&&(fdjtDOM.viewHeight()));
	    if (view_top!==sbook_sync_off) {
		sbookHUD.style.top=view_top+'px';
		sbook_sync_off=view_top;}
	    if (view_height!==sbook_sync_height) {
		if (view_height) {
		    sbookHUD.style.height=view_height+'px';
		    sbookFoot.style.top='';
		    sbookFoot.style.bottom='0px';}
		else {
		    sbookHUD.style.height='';
		    sbookFoot.style.bottom='';
		    sbookFoot.style.top=(fdjtDOM.viewHeight()-42)+'px';}
		sbook_sync_height=view_height;}}
	sbook.syncHUD=syncHUD;
	
	/* The APP HUD */
	
	var sbook_helphud_highlight=false;
	var sbook_helphud_display=false;
	var sbook_helphud_opacity=false;
	
	function sbookHelpHighlight(hudelt){
	    // fdjtTrace("Highlighting hud elt %o",hudelt);
	    if (hudelt===sbook_helphud_highlight) return;
	    if (sbook_helphud_highlight) {
		sbook_helphud_highlight.style.display=sbook_helphud_display;
		sbook_helphud_highlight.style.opacity=sbook_helphud_opacity;
		sbook_helphud_highlight=false;
		sbook_helphud_opacity=false;
		sbook_helphud_display=false;}
	    if (hudelt) {
		sbook_helphud_highlight=hudelt;
		sbook_helphud_display=hudelt.style.display;
		sbook_helphud_opacity=hudelt.style.opacity;
		hudelt.style.display='block';
		hudelt.style.opacity=0.9;}}

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
	       version
	       ?? Maybe show link to the dynamic version
	    */
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
		fdjtDOM.getMeta("SBOOKTITLE")||fdjtDOM.getMeta("TITLE")||
		document.title;
	    var byline=
		fdjtID("SBOOKBYLINE")||fdjtID("SBOOKAUTHOR")||
		fdjtDOM.getMeta("SBOOKBYLINE")||fdjtDOM.getMeta("BYLINE")||
		fdjtDOM.getMeta("SBOOKAUTHOR")||fdjtDOM.getMeta("AUTHOR");
	    var copyright=
		fdjtID("SBOOKCOPYRIGHT")||
		fdjtDOM.getMeta("SBOOKCOPYRIGHT")||fdjtDOM.getMeta("COPYRIGHT")||
		fdjtDOM.getMeta("RIGHTS");
	    var publisher=
		fdjtID("SBOOKPUBLISHER")||
		fdjtDOM.getMeta("SBOOKPUBLISHER")||
		fdjtDOM.getMeta("PUBLISHER");
	    var description=
		fdjtID("SBOOKDESCRIPTION")||
		fdjtDOM.getMeta("SBOOKDESCRIPTION")||
		fdjtDOM.getMeta("DESCRIPTION");
	    var digitized=
		fdjtID("SBOOKDIGITIZED")||
		fdjtDOM.getMeta("SBOOKDIGITIZED")||
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
	    var appuri="https://"+sbook.server+"/v3/manage.fdcgi"+query;
	    if (query.search("REFURI=")<0)
		appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
	    if (query.search("DOCURI=")<0)
		appuri=appuri+"&DOCURI="+encodeURIComponent(sbook.docuri);
	    if (document.title) {
		appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
	    fdjtID("MANAGEAPP").src=appuri;}


	/* Previewing */
	
	var sbook_preview_delay=250;
	
	function sbookPreview(elt,offset){
	    var cxt=false;
	    if (!(elt)) 
		if (sbook.preview) {
		    if (sbook.preview_title)
			sbook.preview.title=sbook.preview_title;
		    sbook.preview_title=false;
		    fdjtDOM.dropClass(document.body,"preview");
		    fdjtDOM.dropClass(sbook.preview,"previewing");
		    fdjtUI.scrollRestore();
		    sbook.preview_target=sbook.preview=false;
		    return;}
	    else {
		fdjtDOM.dropClass(document.body,"preview");
		fdjtUI.scrollRestore();
		return;}
	    if (sbook.preview)
		fdjtDOM.dropClass(sbook.preview,"previewing");
	    if ((elt===sbook.root)||(elt===document.body))
		return;
	    if (!(offset)) {
		var ref=sbook.getRef(elt);
		if (ref) {
		    offset=displayOffset();
		    elt=ref;}
		else offset=displayOffset();}
	    fdjtDOM.addClass(document.body,"preview");
	    fdjtDOM.addClass(elt,"previewing");
	    sbook.last_preview=elt;
	    sbook.preview_target=sbook.preview=elt;
	    if ((elt.title)&&(elt!==sbook.target))
		sbook.preview_title=elt.title;
	    elt.title='click to jump to this passage';
	    if ((elt.getAttribute) &&
		(elt.getAttribute("toclevel")) ||
		((elt.sbookinfo) && (elt.sbookinfo.level)))
		cxt=false;
	    else if (elt.head)
		cxt=elt.head;
	    fdjtUI.scrollPreview(elt,cxt,offset);}

	function _sbookPreviewSync(){
	    if (sbook.preview===sbook.preview_target) return;
	    sbookPreview(sbook.preview_target);
	    if (sbook.floathud) syncHUD();}

	function sbookSetPreview(ref,delay){
	    if ((delay)&&(typeof delay !== 'number'))
		delay=((ref)?(sbook_preview_delay):(sbook_preview_delay*5));
	    sbook.preview_target=ref;
	    if (!(delay)) sbookPreview(ref);
	    else if (ref)
		setTimeout(_sbookPreviewSync,delay);
	    else setTimeout(_sbookPreviewSync,delay);}
	sbook.Preview=sbookSetPreview;

	function displayOffset(){
	    var toc;
	    if (sbook.mode)
		if (toc=fdjtID("SBOOKTOC"))
		    return -((toc.offsetHeight||50)+15);
	    else return -60;
	    else return -40;}

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
