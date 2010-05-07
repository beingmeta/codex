/* -*- Mode: Javascript; -*- */

var sbooks_hud_id="$Id$";
var sbooks_hud_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
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

// The head HUD
var sbookHead=false;
// The foot HUD
var sbookFoot=false;
// This is the HUD where all glosses are displayed
var sbookGlossesHUD=false;
// This is the HUD for tag searching
var sbookSearchHUD=false;
// This is the TOC HUD for navigation
var sbookNavHUD=false;
// This is the "info HUD" for informative message
var sbook_message_timeout=5000;

// This is the last active 'dash' tab
var sbook_last_dash="help";
// This is the regex for all sbook apps
var sbook_apps=["help","login","sbookapp","device","dashtoc","about"];

function sbookSetupHUD()
{
  if (fdjtID("SBOOKHUD")) return;
  else {
    sbookHUD=fdjtDOM("div#SBOOKHUD");
    sbookHUD.sbookui=true;
    sbookHUD.innerHTML=sbook_hudtext;
    fdjtDOM.prepend(document.body,sbookHUD);}
  var console=fdjtID("SBOOKCONSOLE");
  console.innerHTML=sbook_consoletext;
  var dash=fdjtID("SBOOKDASH");
  dash.innerHTML=sbook_dashtext.replace('%HELPTEXT',sbook_helptext);
  var search=fdjtID("SBOOKSEARCH");
  search.innerHTML=sbook_searchtext;
  sbookSetupSearchHUD(search);
  var glosses=fdjtID("SBOOKALLGLOSSES");
  sbookSetupSummaryDiv(glosses);
  if ((sbook_allglosses)&&(sbook_allglosses.length))
    sbookShowSummaries(sbook_allglosses,allglosses,false);
  var bookmark=fdjtID("SBOOKMARKHUD");
  bookmark.innerHTML=sbook_markhudtext;
  sbookSetupMarkHUD(bookmark);
  fdjtUI.Delay(1500,false,sbookUpdateDash);
}

/* Creating the HUD */

function sbookSetupNavHUD(root_info)
{
  var navhud=sbookCreateNavHUD("div#SBOOKTOC.hudblock",root_info);
  var toc_button=fdjtID("SBOOKTOCBUTTON");
  toc_button.onclick=sbookTOCButton_onclick;
  if (sbook_interaction==='mouse') {
    toc_button.onmouseover=fdjtDOM.classAdder("SBOOKTOC","hover");
    toc_button.onmouseout=fdjtDOM.classDropper("SBOOKTOC","hover");}
  toc_button.style.visibility=null;
  fdjtDOM.replace("SBOOKTOC",navhud);
  fdjtDOM(fdjtID("DASHTOC"),sbookStaticNavHUD("div#SBOOKDASHTOC",root_info));
}

function sbookCreateNavHUD(eltspec,root_info)
{
  var toc_div=sbookTOC(root_info,0,false,"SBOOKTOC4");
  var div=fdjtDOM(eltspec||"div#SBOOKTOC.hudblock.hud",toc_div);
  if (!(eltspec)) sbookNavHUD=div;
  if (sbook_interaction==="mouse") {
    div.addEventListener("mouseover",sbookTOC.onmouseover,false);
    div.addEventListener("mouseout",sbookTOC.onmouseout,false);
    div.addEventListener("mousedown",sbookTOC.onmousedown,false);
    div.addEventListener("mouseup",sbookTOC.onmouseup,false);
    div.addEventListener("click",sbookTOC.onclick,false);}
  else div.addEventListener("click",sbookTOC.oneclick,false);
  return div;
}

function sbookStaticNavHUD(eltspec,root_info)
{
  var toc_div=sbookTOC(root_info,0,false,"SBOOKDASHTOC4");
  var div=fdjtDOM(eltspec||"div#SBOOKDASHTOC",toc_div);
  if (!(eltspec)) sbookNavHUD=div;
  if (sbook_interaction==="mouse") {
    div.addEventListener("mouseover",sbookTOC.onmouseover,false);
    div.addEventListener("mouseout",sbookTOC.onmouseout,false);
    div.addEventListener("mousedown",sbookTOC.onmousedown,false);
    div.addEventListener("mouseup",sbookTOC.onmouseup,false);
    div.addEventListener("click",sbookTOC.onholdclick,false);}
  else div.addEventListener("click",sbookTOC.oneclick,false);
  return div;
}

function createSBOOKHUD()
{
  var hud=fdjtID("SBOOKHUD");
  if (hud) return hud;
  else {
    var toc_button=
      fdjtImage(sbicon("CompassIcon40x40.png"),
		"#SBOOKTOCBUTTON.hudbutton",
		"toc","navigate table of contents");
    toc_button.onclick=sbookTOCButton_onclick;
    var search_button=
      fdjtImage(sbicon("TagSearch40x40.png"),
		"#SBOOKSEARCHBUTTON.hudbutton",
		"search","search the content using semantic tags");
    search_button.onclick=sbookSearchButton_onclick;
    var dash_button=
      fdjtImage(sbicon("sbooksappicon40x40.png"),".hudbutton.app","app",
		"Click for Help, settings, book description, etc");
    dash_button.onclick=sbookDashButton_onclick;
    if (sbook_interaction==='mouse') {
      dash_button.onmouseover=fdjtDOM.classAdder("SBOOKDASH","hover");
      dash_button.onmouseout=fdjtDOM.classDropper("SBOOKDASH","hover");}
    
    var glosses_button=
      fdjtImage(sbicon("sbookspeople40x40.png"),
		"#SBOOKGLOSSESBUTTON.hudbutton","glosses",
		"Click to browse glosses for this book");
    glosses_button.onclick=sbookGlossesButton_onclick;
    
    var console=fdjtDOM("div#SBOOKCONSOLE.sbookconsole.hudblock");
    console.innerHTML=sbook_consoletext;

    var markhud=
      fdjtDOM("div#SBOOKMARKHUD.hudblock",
	      sbookCreateMarkHUD("div#SBOOKMARK"),
	      fdjtDOM("div#SBOOKMARKGLOSSES.sbookglosses"));

    var headhud=
      fdjtDOM("div#SBOOKHEAD",toc_button,search_button,
	      fdjtDOM("div#SBOOKTOC.hudblock"),
	      sbookCreateSearchHUD("div#SBOOKSEARCH.hudblock.sbooksearch"),
	      sbookCreateGlossesHUD(),
	      sbookCreateDash(),
	      markhud,
	      console);
    var foothud=fdjtDOM("div#SBOOKFOOT",dash_button,glosses_button,
			fdjtDOM("div#SBOOKTAGS.hudblock.tags"));
      
    sbookHead=headhud; sbookFoot=foothud;
    hud=fdjtDOM("div#SBOOKHUD",headhud,foothud);
    
    sbookHUD=hud; hud.sbookui=true; hud.title="";
    hud.setAttribute("flatwidth","0");
    
    return hud;}
}

function sbookInitSocialHUD()
{
  var glosses_button=fdjtID("SBOOKGLOSSESBUTTON");
  glosses_button.onclick=sbookGlossesButton_onclick;
  if (sbook_interaction==='mouse') {
    glosses_button.onmouseover=fdjtDOM.classAdder("SBOOKGLOSSES","hover");
    glosses_button.onmouseout=fdjtDOM.classDropper("SBOOKGLOSSES","hover");}
  glosses_button.style.visibility=null;
}

function sbookInitSearchHUD()
{
  var search_button=fdjtID("SBOOKSEARCHBUTTON");
  search_button.onclick=sbookSearchButton_onclick;
  if (sbook_interaction==='mouse') {
    search_button.onmouseover=fdjtDOM.classAdder("#SBOOKSEARCH#SBOOKTAGS","hover");
    search_button.onmouseout=fdjtDOM.classDropper("#SBOOKSEARCH#SBOOKTAGS","hover");}
  search_button.style.visibility=null;
}

/* Mode controls */

var sbookHUD_displaypat=/(hudup)|(hudresults)|(hudglosses)/g;
var sbookHUDMode_pat=
  /(login)|(device)|(sbookapp)|(help)|(searching)|(browsing)|(toc)|(glosses)|(mark)|(context)|(dashtoc)|(about)|(console)/g;

var sbook_footmodes=
  ["login","device","sbookapp","help","dashtoc","about","glosses","console"];
var sbook_headmodes=["toc","searching","browsing"];

var sbook_last_headmode="toc";
var sbook_last_footmode="help";

function sbookHUDMode(mode)
{
  if (sbook_trace_mode)
    fdjtLog("[%fs] sbookHUDMode %o, cur=%o dbc=%o",
	    fdjtET(),mode,sbook_mode,document.body.className);
  if (sbook_preview) sbookSetPreview(false);
  if (sbook_notfixed) {
    // sbookMoveMargins(sbook_curinfo);
    sbookSyncHUD();}
  if (mode)
    if (mode===sbook_mode) {}
    else {
      if (mode===true) mode="context";
      if (typeof mode !== 'string') 
	throw new Error('mode arg not a string');
      if ((mode==="sbookapp")&&(!(fdjtID("APPFRAME").src)))
	sbookSetupAppFrame();
      sbook_mode=mode;
      sbook_last_mode=mode;
      if (fdjtKB.contains(sbook_apps,mode)) sbook_last_dash=mode;
      if (fdjtKB.contains(sbook_headmodes,mode)) sbook_last_headmode=mode;
      if (fdjtKB.contains(sbook_footmodes,mode)) sbook_last_footmode=mode;
      fdjtDOM.addClass(document.body,"hudup");
      fdjtDOM.swapClass(sbookHUD,sbookHUDMode_pat,mode);
      if ((mode==="glosses")&&(sbook_target))
	sbookScrollGlosses(sbook_target);}
  else {
    sbook_last_mode=sbook_mode;
    sbook_mode=false;
    fdjtDOM.dropClass(sbookHUD,sbookHUDMode_pat);
    fdjtDOM.dropClass(document.body,"hudup");}
}
function sbookHUDToggle(mode)
{
  if (fdjtDOM.hasClass(sbookHUD,mode)) {
    sbook_mode=false;
    fdjtDOM.dropClass(sbookHUD,sbookHUDMode_pat);}
  else if (mode) {
    sbook_mode=mode;
    fdjtDOM.swapClass(sbookHUD,sbookHUDMode_pat,mode);}
  else {
    sbook_mode=false;
    fdjtDOM.dropClass(sbookHUD,sbookHUDMode_pat);}
}

function sbookHUDFlash(mode,usecs)
{
  if (mode) {
    fdjtDOM.swapClass(sbookHUD,sbookHUDMode_pat,mode);
    fdjtDOM.addClass(document.body,"hudup");
    if (usecs) fdjtUI.Delay(usecs,"flash",sbookHUDFlash);}
  else if (usecs)
    fdjtUI.Delay(usecs,"flash",sbookHUDFlash);
  else if (sbook_mode)
    fdjtDOM.swapClass(sbookHUD,sbookHUDMode_pat,sbook_mode);
  else {
    fdjtDOM.dropClass(sbookHUD,sbookHUDMode_pat);
    fdjtDOM.dropClass(document.body,"hudup");}
}

function sbookDropHUD()
{
  return sbookHUDMode(false);
}

/* HUD Messages */

var sbook_message_timer=false;

function sbookMessage(message)
{
  fdjtDOM.replace("SBOOKMESSAGE",
	      fdjtDOM("div.message",
		      fdjtDOM("div.head",message),
		      fdjtState.argVec(arguments,1)));
  fdjtDOM.prepend("SBOOKMESSAGELOG",
	      fdjtDOM("div.logentry",
		      fdjtDOM("span.time",fdjtET()),
		      message));
  sbookHUDMode("console");
}

function sbookFlashMessage(arg0)
{
  var duration=sbook_message_timeout; var message; var args;
  if (!(arg0)) message=false;
  else if (typeof arg0 === 'number') {
    if (arg0<0) duration=sbook_message_duration;
    else if (arg0<50) duration=arg0*1000;
    else duration=arg0;
    message=arguments[1];
    args=fdjtState.argVec(arguments,2);}
  else {
    duration=sbook_message_duration; message=arg0;
    args=fdjtState.argVec(arguments,1);}
  if (sbook_message_timer) clearTimeout(sbook_message_timer);
  if (message) {
    fdjtDOM.replace("SBOOKMESSAGE",
		fdjtDOM("div.message",fdjtDOM("div.head",message),args));
    fdjtDOM.prepend("SBOOKMESSAGELOG",
		fdjtDOM("div.logentry",
			fdjtDOM("span.time",fdjtET()),
			message));}
  fdjtDOM.dropClass(sbookHUD,sbookHUDMode_pat);
  fdjtDOM.addClass(sbookHUD,"console");
  var mode=sbook_mode;
  sbook_message_timer=
    setTimeout(function() {
	if (mode==="console") sbookHUDMode(false);
	else if (sbook_mode==="console") sbookHUDMode(false);	
	else if (mode) {
	  fdjtDOM.swapClass(sbookHUD,"console",mode);}},
      duration);
}

function sbookGetStableId(elt)
{
  var info=sbookInfo(elt);
  // fdjtLog("Scrolling to %o with id %s/%s",target,info.frag,target.id);
  if ((info) && (info.frag) && (!(info.frag.search(/TMPID/)==0)))
    return info.frag;
  else if ((elt.id) && (!(elt.id.search(/TMPID/)==0)))
    return elt.id;
  else return false;
}

var sbook_sync_head=false;
var sbook_sync_foot=false;

function sbookSyncHUD()
{
  if (!(sbook_notfixed)) return;
  if (window.offsetY!==sbook_sync_head) {
    sbookHead.style.top=window.scrollY+'px';
    // sbookHead.style["-webkit-transformation"]="translate(0px,"+window.scrollY+"px)";
    sbook_sync_head=window.scrollY;
    sbookHead.style.maxHeight=(window.innerHeight-100)+'px';}
  if ((window.scrollY+window.innerHeight)!==sbook_sync_foot) {
    sbookFoot.style.top=(window.scrollY+window.innerHeight-42)+'px';
    // sbookFoot.style["-webkit-transformation"]="translate(0px,"+(window.scrollY+window.innerHeight-50)+"px)";
    sbook_sync_foot=(window.scrollY+window.innerHeight);}
}

/* The APP HUD */

var sbook_helphud_highlight=false;
var sbook_helphud_display=false;
var sbook_helphud_opacity=false;

function sbookHelpHighlight(hudelt)
{
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
    hudelt.style.opacity=0.9;}
}

/* The App HUD */

function sbookUpdateDash()
{
  var hidehelp=fdjtID("SBOOKHIDEHELP");
  var dohidehelp=fdjtState.getCookie("sbookhidehelp");
  if (!(hidehelp)) {}
  else if (dohidehelp==='no') hidehelp.checked=false;
  else if (dohidehelp) hidehelp.checked=true;
  else hidehelp.checked=false;
  if (hidehelp)
    hidehelp.onchange=function(evt){
      // fdjtTrace("change on %o: %o checked=%o",hidehelp,evt,hidehelp.checked);
      if (hidehelp.checked)
	fdjtState.setCookie("sbookhidehelp",true,false,"/"); /* document.location.host */
      else fdjtState.setCookie("sbookhidehelp","no",false,"/");};
  fdjtUI.AutoPrompt.setup(fdjtID("SBOOKDASH"));
  //fdjtAnchorSubmit_setup(fdjtID("SBOOKDASH"));
  var refuris=document.getElementsByName("REFURI");
  if (refuris) {
    var i=0; var len=refuris.length;
    while (i<len)
      if (refuris[i].value==='fillin')
	refuris[i++].value=sbook_refuri;
      else i++;}
  sbookUpdateAboutInfo();
  /* Get various external APPLINK uris */
  var offlineuri=fdjtDOM.getLink("sbook.offline")||sbookAltLink("offline");
  var epuburi=fdjtDOM.getLink("sbook.epub")||sbookAltLink("ebub");
  var mobiuri=fdjtDOM.getLink("sbook.mobi")||sbookAltLink("mobi");
  var zipuri=fdjtDOM.getLink("sbook.mobi")||sbookAltLink("mobi");
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
  /* If the book is offline, don't bother showing the link to the offline
     version
     ?? Maybe show link to the dynamic version
  */
  if (sbook_offline) fdjtDOM.addClass(document.body,"sbookoffline");
}

function _sbookFillTemplate(template,spec,content)
{
  if (!(content)) return;
  var elt=fdjtDOM.$(spec,template);
  if ((elt)&&(elt.length>0)) elt=elt[0];
  else return;
  if (typeof content === 'string')
    elt.innerHTML=content;
  else if (content.cloneNode)
    fdjtDOM.replace(elt,content.cloneNode(true));
  else fdjtDOM(elt,content);
}

function sbookUpdateAboutInfo()
{
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
    if (cover_elt) fdjtDOM(cover_elt,fdjtImage(cover));}
}

/* Previewing */

var sbook_preview_target=false;
var sbook_preview_delay=250;
var sbook_preview_title=false;

function sbookPreview(elt,offset)
{
  var cxt=false;
  // alert(fdjtObj2String(elt));
  // sbook_trace("sbookPreview",elt);
  if (!(elt)) 
    if (sbook_preview) {
      if (sbook_preview_title)
	sbook_preview.title=sbook_preview_title;
      sbook_preview_title=false;
      fdjtDOM.dropClass(document.body,"preview");
      fdjtDOM.dropClass(sbook_preview,"previewing");
      fdjtUI.scrollRestore();
      sbook_preview_target=sbook_preview=false;
      return;}
    else {
      fdjtDOM.dropClass(document.body,"preview");
      fdjtUI.scrollRestore();
      return;}
  if (sbook_preview)
    fdjtDOM.dropClass(sbook_preview,"previewing");
  if ((elt===sbook_root)||(elt===document.body))
    return;
  if (!(offset))
    if (elt.sbook_ref) {
      offset=elt.preview_off||sbookDisplayOffset();
      elt=elt.sbook_ref;}
    else offset=sbookDisplayOffset();
  fdjtDOM.addClass(document.body,"preview");
  fdjtDOM.addClass(elt,"previewing");
  sbook_last_preview=elt;
  sbook_preview_target=sbook_preview=elt;
  if ((elt.title)&&(elt!==sbook_target))
    sbook_preview_title=elt.title;
  elt.title='click to jump to this passage';
  if ((elt.getAttribute) &&
      (elt.getAttribute("toclevel")) ||
      ((elt.sbookinfo) && (elt.sbookinfo.level)))
    cxt=false;
  else if (elt.head)
    cxt=elt.head;
  fdjtUI.scrollPreview(elt,cxt,offset);
}

function _sbookPreviewSync()
{
  if (sbook_preview===sbook_preview_target) return;
  sbookPreview(sbook_preview_target);
  if (sbook_notfixed) sbookSyncHUD();
}

function sbookSetPreview(ref)
{
  sbook_preview_target=ref;
  if (ref)
    setTimeout(_sbookPreviewSync,sbook_preview_delay);
  else setTimeout(_sbookPreviewSync,sbook_preview_delay*5);
}

/* Making the icon */

var sbook_preview_icon="binoculars24x24.png";

function sbookPreviewIcon(img)
{
  var img=fdjtImage(sbicon(img||"binoculars24x24.png"),"previewicon","[pre]",
		    "preview: click or hold mouse button or control key");
  img.addEventListener("mouseover",sbookTOC_onmouseover,false);
  img.addEventListener("mouseout",sbookTOC_onmouseout,false);
  img.addEventListener("mousedown",fdjtDOM.cancel,false);
  img.addEventListener("mouseup",fdjtDOM.cancel,false);
  return img;
}

function sbookPreviewIcon(img)
{
  return false;
}

/* Button methods */

function sbookTOCButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="toc") {
    sbookHUDMode(false);
    fdjtDOM.dropClass("SBOOKTOC","hover");}
  else sbookHUDMode("toc");
  fdjtDOM.cancel(evt);
}

function sbookSearchButton_onclick(evt)
{
  evt=evt||event||null;
  if ((sbook_mode==="searching") || (sbook_mode==="browsing")) {
    sbookHUDMode(false);
    fdjtDOM.dropClass("SBOOKSEARCH","hover");
    fdjtID("SBOOKSEARCHTEXT").blur();}
  else {
    sbookHUDMode("searching");
    fdjtID("SBOOKSEARCHTEXT").focus();
    fdjtDOM.cancel(evt);}
}

function sbookDashButton_onclick(evt)
{
  if (sbook_mode)
    if (fdjtKB.contains(sbook_apps,sbook_mode))
      sbookHUDMode(false);
    else sbookHUDMode(sbook_last_dash);
  else sbookHUDMode(sbook_last_dash);
  fdjtDOM.cancel(evt);
}

function sbookGlossesButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="glosses") {
    sbookHUDMode(false);
    fdjtDOM.dropClass("SBOOKGLOSSES","hover");}
  else sbookHUDMode("glosses");
  fdjtDOM.cancel(evt);
}

function sbookLoginButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="login") sbookHUDMode(false);
  else sbookHUDMode("login");
  evt.cancelBubble=true;
}

function sbookFootHUD_onclick(evt)
{
  evt=evt||event||null;
  /* If it gets through... */
  if (sbook_mode) sbookHUDMode(false);
  else sbookHUDMode(sbook_last_footmode);
}

function sbookHeadHUD_onclick(evt)
{
  evt=evt||event||null;
  /* If it gets through... */
  if (sbook_mode) sbookHUDMode(false);
  else sbookHUDMode(sbook_last_headmode);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
