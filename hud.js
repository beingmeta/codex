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

// This is the last active 'app' tab
var sbook_last_app="help";
// This is the regex for all sbook apps
var sbook_apps=["help","login","sbookapp","device","dashtoc","about"];

function createSBOOKHUD()
{
  var hud=$ID("SBOOKHUD");
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
      dash_button.onmouseover=fdjtClassAdder("SBOOKDASH","hover");
      dash_button.onmouseout=fdjtClassDropper("SBOOKDASH","hover");}
    
    var glosses_button=
      fdjtImage(sbicon("sbookspeople40x40.png"),
		"#SBOOKGLOSSESBUTTON.hudbutton","glosses",
		"Click to browse glosses for this book");
    glosses_button.onclick=sbookGlossesButton_onclick;
    
    var console=fdjtDOM("div#SBOOKCONSOLE.sbookconsole.hudblock");
    console.innerHTML=sbook_messagebox;

    var markhud=
      fdjtDOM("div#SBOOKMARKHUD.hudblock",
	      sbookCreateMarkHUD("#SBOOKMARK"),
	      fdjtDOM("div#SBOOKMARKGLOSSES.sbookglosses"));

    var headhud=
      fdjtDOM("div#SBOOKHEAD",toc_button,search_button,
	      fdjtDOM("div#SBOOKTOC.hudblock"),
	      sbookCreateSearchHUD("#SBOOKSEARCH.hudblock.sbooksearch"),
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

function sbookInitNavHUD(root_info)
{
  var navhud=sbookCreateNavHUD("#SBOOKTOC.hudblock",root_info);
  var toc_button=$ID("SBOOKTOCBUTTON");
  toc_button.onclick=sbookTOCButton_onclick;
  if (sbook_interaction==='mouse') {
    toc_button.onmouseover=fdjtClassAdder("SBOOKTOC","hover");
    toc_button.onmouseout=fdjtClassDropper("SBOOKTOC","hover");}
  toc_button.style.visibility=null;
  fdjtReplace("SBOOKTOC",navhud);
  fdjtAppend($ID("DASHTOC"),sbookStaticNavHUD("#SBOOKDASHTOC",root_info));
}

function sbookInitSocialHUD()
{
  var glosses_button=$ID("SBOOKGLOSSESBUTTON");
  glosses_button.onclick=sbookGlossesButton_onclick;
  if (sbook_interaction==='mouse') {
    glosses_button.onmouseover=fdjtClassAdder("SBOOKGLOSSES","hover");
    glosses_button.onmouseout=fdjtClassDropper("SBOOKGLOSSES","hover");}
  glosses_button.style.visibility=null;
}

function sbookInitSearchHUD()
{
  var search_button=$ID("SBOOKSEARCHBUTTON");
  search_button.onclick=sbookSearchButton_onclick;
  if (sbook_interaction==='mouse') {
    search_button.onmouseover=fdjtClassAdder("#SBOOKSEARCH#SBOOKTAGS","hover");
    search_button.onmouseout=fdjtClassDropper("#SBOOKSEARCH#SBOOKTAGS","hover");}
  search_button.style.visibility=null;
}

/* Creating the HUD */

function sbookCreateNavHUD(eltspec,root_info)
{
  var toc_div=sbookTOC(root_info,0,false,"SBOOKTOC4");
  var div=fdjtDiv(eltspec||"#SBOOKTOC.hudblock.hud",toc_div);
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
  var div=fdjtDiv(eltspec||"#SBOOKDASHTOC",toc_div);
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
      if ((mode==="sbookapp")&&(!($ID("APPFRAME").src)))
	sbookSetupAppFrame();
      sbook_mode=mode;
      sbook_last_mode=mode;
      if (fdjtContains(sbook_apps,mode)) sbook_last_app=mode;
      if (fdjtContains(sbook_headmodes,mode)) sbook_last_headmode=mode;
      if (fdjtContains(sbook_footmodes,mode)) sbook_last_footmode=mode;
      fdjtAddClass(document.body,"hudup");
      fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);
      if ((mode==="glosses")&&(sbook_target))
	sbookScrollGlosses(sbook_target);}
  else {
    sbook_last_mode=sbook_mode;
    sbook_mode=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);
    fdjtDropClass(document.body,"hudup");}
}
function sbookHUDToggle(mode)
{
  if (fdjtHasClass(sbookHUD,mode)) {
    sbook_mode=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);}
  else if (mode) {
    sbook_mode=mode;
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);}
  else {
    sbook_mode=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);}
}

function sbookHUDFlash(mode,usecs)
{
  if (mode) {
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);
    fdjtAddClass(document.body,"hudup");
    if (usecs) fdjtDelay(usecs,sbookHUDFlash,false,sbookHUD,"flash");}
  else if (usecs)
    fdjtDelay(usecs,sbookHUDFlash,false,sbookHUD,"flash");
  else if (sbook_mode)
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,sbook_mode);
  else {
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);
    fdjtDropClass(document.body,"hudup");}
}

function sbookDropHUD()
{
  return sbookHUDMode(false);
}

/* HUD Messages */

var sbook_message_timer=false;

function sbookMessage(message)
{
  fdjtReplace("SBOOKMESSAGE",
	      fdjtDOM("div.message",
		      fdjtDOM("div.head",message),
		      fdjtArguments(arguments,1)));
  fdjtPrepend("SBOOKMESSAGELOG",
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
    args=fdjtArguments(arguments,2);}
  else {
    duration=sbook_message_duration; message=arg0;
    args=fdjtArguments(arguments,1);}
  if (sbook_message_timer) clearTimeout(sbook_message_timer);
  if (message) {
    fdjtReplace("SBOOKMESSAGE",
		fdjtDOM("div.message",fdjtDOM("div.head",message),args));
    fdjtPrepend("SBOOKMESSAGELOG",
		fdjtDOM("div.logentry",
			fdjtDOM("span.time",fdjtET()),
			message));}
  fdjtDropClass(sbookHUD,sbookHUDMode_pat);
  fdjtAddClass(sbookHUD,"console");
  var mode=sbook_mode;
  sbook_message_timer=
    setTimeout(function() {
	if (mode==="console") sbookHUDMode(false);
	else if (sbook_mode==="console") sbookHUDMode(false);	
	else if (mode) {
	  fdjtSwapClass(sbookHUD,"console",mode);}},
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

function sbookCreateDash(eltspec)
{
  var div=fdjtDiv(eltspec||"#SBOOKDASH.hudblock.scrollhud");
  div.onmouseover=function(evt){
    var target=$T(evt);
    while (target)
      if ((target.getAttribute) &&
	  (target.getAttribute('hudref'))) break;
      else target=target.parentNode;
    if ((target) && (target.getAttribute('hudref'))) {
      var hudelt=$ID(target.getAttribute('hudref'));
      sbookHelpHighlight(hudelt);}};
  div.onmouseout=function(evt){
    var target=$T(evt);
    sbookHelpHighlight(false);};
  div.innerHTML=sbook_apptext;
  fdjtDelay(1500,sbookUpdateDash,false,sbook_root);
  return div;
}

function sbookUpdateDash()
{
  var hidehelp=$ID("SBOOKHIDEHELP");
  var dohidehelp=fdjtGetCookie("sbookhidehelp");
  if (!(hidehelp)) {}
  else if (dohidehelp==='no') hidehelp.checked=false;
  else if (dohidehelp) hidehelp.checked=true;
  else hidehelp.checked=false;
  if (hidehelp)
    hidehelp.onchange=function(evt){
      // fdjtTrace("change on %o: %o checked=%o",hidehelp,evt,hidehelp.checked);
      if (hidehelp.checked)
	fdjtSetCookie("sbookhidehelp",true,false,"/"); /* document.location.host */
      else fdjtSetCookie("sbookhidehelp","no",false,"/");};
  fdjtAutoPrompt_setup($ID("SBOOKDASH"));
  fdjtAnchorSubmit_setup($ID("SBOOKDASH"));
  var refuris=document.getElementsByName("REFURI");
  if (refuris) {
    var i=0; var len=refuris.length;
    while (i<len)
      if (refuris[i].value==='fillin')
	refuris[i++].value=sbook_refuri;
      else i++;}
  sbookUpdateAboutInfo();
  /* Get various external APPLINK uris */
  var offlineuri=fdjtGetLink("sbook.offline")||sbookAltLink("offline");
  var epuburi=fdjtGetLink("sbook.epub")||sbookAltLink("ebub");
  var mobiuri=fdjtGetLink("sbook.mobi")||sbookAltLink("mobi");
  var zipuri=fdjtGetLink("sbook.mobi")||sbookAltLink("mobi");
  if (offlineuri) {
    var elts=document.getElementsByName("SBOOKOFFLINELINK");
    var i=0; while (i<elts.length) {
      var elt=elts[i++];
      if (offlineuri!=='none') elt.href=offlineuri;
      else {
	elt.href=false;
	fdjtAddClass(elt,"deadlink");
	elt.title='this sBook is not available offline';}}}
  if (epuburi) {
    var elts=document.getElementsByName("SBOOKEPUBLINK");
    var i=0; while (i<elts.length) {
      var elt=elts[i++];
      if (epuburi!=='none') elt.href=epuburi;
      else {
	elt.href=false;
	fdjtAddClass(elt,"deadlink");
	elt.title='this sBook is not available as an ePub';}}}
  if (mobiuri) {
    var elts=document.getElementsByName("SBOOKMOBILINK");
    var i=0; while (i<elts.length) {
      var elt=elts[i++];
      if (mobiuri!=='none') elt.href=mobiuri;
      else {
	elt.href=false;
	fdjtAddClass(elt,"deadlink");
	elt.title='this sBook is not available as a MOBIpocket format eBook';}}}
  if (zipuri) {
    var elts=document.getElementsByName("SBOOKZIPLINK");
    var i=0; while (i<elts.length) {
      var elt=elts[i++];
      if (zipuri!=='none') elt.href=zipuri;
      else {
	elt.href=false;
	fdjtAddClass(elt,"deadlink");
	elt.title='this sBook is not available as a ZIP bundle';}}}
  /* If the book is offline, don't bother showing the link to the offline
     version
     ?? Maybe show link to the dynamic version
  */
  if (sbook_offline) fdjtAddClass(document.body,"sbookoffline");
}

function _sbookFillTemplate(template,spec,content)
{
  if (!(content)) return;
  var elt=FDJT$(spec,template);
  if ((elt)&&(elt.length>0)) elt=elt[0];
  else return;
  if (typeof content === 'string')
    elt.innerHTML=content;
  else if (content.cloneNode)
    fdjtReplace(elt,content.cloneNode(true));
  else fdjtAppend(elt,content);
}

function sbookUpdateAboutInfo()
{
  if ($ID("SBOOKABOUT")) {
    fdjtReplace("APPABOUTCONTENT",$ID("SBOOKABOUT"));
    return;}
  var about=$ID("APPABOUT");
  var title=
    $ID("SBOOKTITLE")||
    fdjtGetMeta("SBOOKTITLE")||fdjtGetMeta("TITLE")||
    document.title;
  var byline=
    $ID("SBOOKBYLINE")||$ID("SBOOKAUTHOR")||
    fdjtGetMeta("SBOOKBYLINE")||fdjtGetMeta("BYLINE")||
    fdjtGetMeta("SBOOKAUTHOR")||fdjtGetMeta("AUTHOR");
  var copyright=
    $ID("SBOOKCOPYRIGHT")||
    fdjtGetMeta("SBOOKCOPYRIGHT")||fdjtGetMeta("COPYRIGHT")||
    fdjtGetMeta("RIGHTS");
  var publisher=
    $ID("SBOOKPUBLISHER")||
    fdjtGetMeta("SBOOKPUBLISHER")||
    fdjtGetMeta("PUBLISHER");
  var description=
    $ID("SBOOKDESCRIPTION")||
    fdjtGetMeta("SBOOKDESCRIPTION")||
    fdjtGetMeta("DESCRIPTION");
  var digitized=
    $ID("SBOOKDIGITIZED")||
    fdjtGetMeta("SBOOKDIGITIZED")||
    fdjtGetMeta("DIGITIZED");
  var sbookified=$ID("SBOOKIFIED")||fdjtGetMeta("SBOOKIFIED");
  _sbookFillTemplate(about,".title",title);
  _sbookFillTemplate(about,".byline",byline);
  _sbookFillTemplate(about,".publisher",publisher);
  _sbookFillTemplate(about,".copyright",copyright);
  _sbookFillTemplate(about,".description",description);
  _sbookFillTemplate(about,".digitized",digitized);
  _sbookFillTemplate(about,".sbookified",sbookified);
  _sbookFillTemplate(about,".about",$ID("SBOOKABOUT"));
  var cover=fdjtGetLink("cover");
  if (cover) {
    var cover_elt=FDJT$(".cover",about)[0];
    if (cover_elt) fdjtAppend(cover_elt,fdjtImage(cover));}
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
      fdjtDropClass(document.body,"preview");
      fdjtDropClass(sbook_preview,"previewing");
      fdjtScrollRestore();
      sbook_preview_target=sbook_preview=false;
      return;}
    else {
      fdjtDropClass(document.body,"preview");
      fdjtScrollRestore();
      return;}
  if (sbook_preview)
    fdjtDropClass(sbook_preview,"previewing");
  if ((elt===sbook_root)||(elt===document.body))
    return;
  if (!(offset))
    if (elt.sbook_ref) {
      offset=elt.preview_off||sbookDisplayOffset();
      elt=elt.sbook_ref;}
    else offset=sbookDisplayOffset();
  fdjtAddClass(document.body,"preview");
  fdjtAddClass(elt,"previewing");
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
  fdjtScrollPreview(elt,cxt,offset);
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
  img.addEventListener("mousedown",fdjtCancelEvent,false);
  img.addEventListener("mouseup",fdjtCancelEvent,false);
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
    fdjtDropClass("SBOOKTOC","hover");}
  else sbookHUDMode("toc");
  fdjtCancelEvent(evt);
}

function sbookSearchButton_onclick(evt)
{
  evt=evt||event||null;
  if ((sbook_mode==="searching") || (sbook_mode==="browsing")) {
    sbookHUDMode(false);
    fdjtDropClass("SBOOKSEARCH","hover");
    $ID("SBOOKSEARCHTEXT").blur();}
  else {
    sbookHUDMode("searching");
    $ID("SBOOKSEARCHTEXT").focus();
    fdjtCancelEvent(evt);}
}

function sbookDashButton_onclick(evt)
{
  if (sbook_mode)
    if (fdjtContains(sbook_apps,sbook_mode))
      sbookHUDMode(false);
    else sbookHUDMode(sbook_last_app);
  else sbookHUDMode(sbook_last_app);
  fdjtCancelEvent(evt);
}

function sbookGlossesButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="glosses") {
    sbookHUDMode(false);
    fdjtDropClass("SBOOKGLOSSES","hover");}
  else sbookHUDMode("glosses");
  fdjtCancelEvent(evt);
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
