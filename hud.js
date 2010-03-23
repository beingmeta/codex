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

// This is the HUD top element
var sbookHUD=false;
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
var sbook_apps=["help","login","sbooksapp","settings","apptoc","about"];

function createSBOOKHUD()
{
  var hud=$("SBOOKHUD");
  if (hud) return hud;
  else {
    var help_button=
      fdjtImage("http://static.beingmeta.com/graphics/HelpIcon40x40.png",
		".hudbutton.help","?","help");
    help_button.onclick=sbookHelpButton_onclick;
    var app_button=
      fdjtImage(sbicon("sbooksappicon40x40.png"),".hudbutton.app","app",
		"Click for Help, settings, book description, etc");
    app_button.onclick=sbookAppButton_onclick;
    var login_button=
      fdjtImage(sbicon("sbooksconnecticon40x40.png"),".hudbutton.login","login",
		"click to login");
    login_button.onclick=sbookLoginButton_onclick;

    var next_button=
      fdjtImage("http://static.beingmeta.com/graphics/PageRight40x40.png",
		".hudbutton",">>","hold to move forward by pages");
    next_button.onmousedown=sbookNextPrev_startit;
    next_button.onmouseup=sbookNextPrev_stopit;
    next_button.onmouseout=sbookNextPrev_stopit;
    next_button.onclick=fdjtCancelEvent;
    var prev_button=
      fdjtImage("http://static.beingmeta.com/graphics/PageLeft40x40.png",
		".hudbutton","<<","hold to move backward by pages");
    prev_button.onmousedown=sbookNextPrev_startit;
    prev_button.onmouseup=sbookNextPrev_stopit;
    prev_button.onmouseout=sbookNextPrev_stopit;
    prev_button.onclick=fdjtCancelEvent;
    var leftedge=fdjtDiv("#SBOOKLEFTEDGE.hud");
    leftedge.title='tap/click to go back';
    leftedge.onclick=sbookLeftEdge_onclick;
    var rightedge=fdjtDiv("#SBOOKRIGHTEDGE.hud");
    rightedge.title='tap/click to go forward';
    rightedge.onclick=sbookRightEdge_onclick;
    var messages=fdjtDiv("#SBOOKCONSOLE");
    messages.innerHTML=sbook_messagebox;
    hud=fdjtDiv
      ("#SBOOKHUD.hud",
       leftedge,rightedge,messages,
       fdjtDiv("#SBOOKTOC.hudblock.hud"),
       fdjtDiv("#SBOOKSOURCES.hudblock.hud"),
       fdjtDiv("#SBOOKGLOSSES.hudblock.hud"),
       fdjtDiv("#SBOOKSEARCH.hudblock.hud"),
       fdjtDiv("#SBOOKTAGS.hudblock.hud.tags"),
       fdjtDiv("#SBOOKMARKHUD.hudblock.hud"),
       sbookCreateAppHUD(),
       app_button,login_button,help_button,
       prev_button,next_button);

    hud.title="";

    hud.onclick=sbookHUD_onclick;
    hud.onmouseover=sbookHUD_onmouseover;
    hud.onmouseout=sbookHUD_onmouseout;

    hud.onclick=hud.onmouseover=hud.onmouseout=fdjtCancelBubble;
    hud.onmousedown=hud.onmouseup=fdjtCancelBubble;

    sbookHUD=hud;

    hud.sbookui=true;

    fdjtPrepend(document.body,hud);

    if (sbook_head) sbookSetHead(sbook_head);

    hud.setAttribute("flatwidth","0");

    return hud;}
}

function sbookInitNavHUD()
{
  var navhud=sbookCreateNavHUD();
  var toc_button=
    fdjtImage(sbicon("CompassIcon40x40.png"),"hudbutton","toc",
	      "navigate table of contents");
  toc_button.onclick=sbookTOCButton_onclick;
  toc_button.onmouseover=fdjtClassAdder("SBOOKTOC","hover");
  toc_button.onmouseout=fdjtClassDropper("SBOOKTOC","hover");
  fdjtReplace("SBOOKTOC",navhud);
  fdjtPrepend(sbookHUD,toc_button);
  fdjtAppend($("APPTOC"),sbookStaticNavHUD("#SBOOKAPPTOC"));
}

function sbookInitSocialHUD()
{
  fdjtReplace("SBOOKGLOSSES",sbookCreateGlossesHUD());
  fdjtReplace("SBOOKSOURCES",sbookCreateSourceHUD());
}

function sbookInitSearchHUD()
{
  fdjtReplace("SBOOKSEARCH",sbookCreateSearchHUD());
  var index_button=
    fdjtImage(sbicon("TagSearch40x40.png"),"hudbutton","index",
	      "search the content using semantic tags");
  index_button.onclick=sbookIndexButton_onclick;
  index_button.onmouseover=fdjtClassAdder("#SBOOKSEARCH#SBOOKTAGS","hover");
  index_button.onmouseout=fdjtClassDropper("#SBOOKSEARCH#SBOOKTAGS","hover");
  fdjtPrepend(sbookHUD,index_button);
}


/* Mode controls */

var sbookHUD_displaypat=/(hudup)|(hudresults)|(hudglosses)/g;
var sbookHUDMode_pat=
  /(login)|(settings)|(sbooksapp)|(help)|(searching)|(browsing)|(toc)|(glosses)|(mark)|(minimal)|(apptoc)|(about)|(console)/g;

function sbookHUDMode(mode)
{
  if (sbook_trace_mode)
    fdjtLog("[%fs] sbookHUDMode %o, cur=%o dbc=%o",
	    fdjtET(),mode,sbook_mode,document.body.className);
  if (sbook_preview) sbookStopPreview();
  if (mode)
    if (mode===sbook_mode) {}
    else {
      if (mode===true) mode="minimal";
      if (typeof mode !== 'string') 
	throw new Error('mode arg not a string');
      if ((mode==="sbooksapp")&&(!($("APPFRAME").src)))
	sbookSetupAppFrame();
      sbook_mode=mode;
      sbook_last_mode=mode;
      if (fdjtContains(sbook_apps,mode)) sbook_last_app=mode;
      fdjtAddClass(document.body,"hudup");
      fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);
      if ((mode==="glosses")&&(sbook_focus))
	sbookScrollGlosses(sbook_focus);}
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
	      fdjtDiv("message",
		      fdjtDiv("head",message),
		      fdjtArguments(arguments,1)));
  fdjtPrepend("SBOOKMESSAGELOG",
	      fdjtDiv("logentry",
		      fdjtSpan("time",fdjtET()),
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
		fdjtDiv("message",fdjtDiv("head",message),args));
    fdjtPrepend("SBOOKMESSAGELOG",
		fdjtDiv("logentry",
			fdjtSpan("time",fdjtET()),
			message));}
  fdjtDropClass(sbookHUD,sbookHUDMode_pat);
  fdjtAddClass(sbookHUD,"console");
  var mode=sbook_mode;
  sbook_message_timer=
    setTimeout(function() {
	if (mode==="console") sbookHUDMode(false);
	else sbookHUDMode(mode);},
      duration);
}

/* Handlers */

function sbookHUD_onmouseover(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookHUD_onmouseover",evt);
  if (sbook_mode) evt.cancelBubble=true;
}

function sbookHUD_onmouseout(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookHUD_onmouseout",evt);
  if (sbook_mode) evt.cancelBubble=true;
}

function sbookHUD_onclick(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookHUD_onclick",evt);
  var target=$T(evt);
  while (target)
    if ((sbook_mode) &&
	((target.tagName==="A") || (target.tagName==="INPUT") ||
	 (target.onclick) || (target.hasAttribute("onclick")))) {
      // evt.cancelBubble=true;
      return;}
    else if ((target.id==="SBOOKTOC")&&(evt.shiftKey)) {
      sbookHUDMode("toc"); target=target.parentNode;}
    else if ((target.id==="SBOOKSEARCH")&&(evt.shiftKey)) {
      sbookHUDMode("searching"); target=target.parentNode;}
    else target=target.parentNode;
  evt.cancelBubble=true;
  if (evt.shiftKey)
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue=false;
}

function sbookGetStableId(elt)
{
  var info=sbook_getinfo(elt);
  // fdjtLog("Scrolling to %o with id %s/%s",target,info.id,target.id);
  if ((info) && (info.id) && (!(info.id.search(/TMPID/)==0)))
    return info.id;
  else if ((elt.id) && (!(elt.id.search(/TMPID/)==0)))
    return elt.id;
  else return false;
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

function sbookCreateAppHUD(eltspec)
{
  var div=fdjtDiv(eltspec||"#SBOOKAPP");
  div.onmouseover=function(evt){
    var target=$T(evt);
    while (target)
      if ((target.getAttribute) &&
	  (target.getAttribute('hudref'))) break;
      else target=target.parentNode;
    if ((target) && (target.getAttribute('hudref'))) {
      var hudelt=$(target.getAttribute('hudref'));
      sbookHelpHighlight(hudelt);}};
  div.onmouseout=function(evt){
    var target=$T(evt);
    sbookHelpHighlight(false);};
  div.innerHTML=sbook_apptext;
  fdjtDelay(1500,sbookUpdateAppHUD,false,sbook_root);
  return div;
}

function sbookUpdateAppHUD()
{
  var hidehelp=$("SBOOKHIDEHELP");
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
  fdjtAutoPrompt_setup($("SBOOKAPP"));
  fdjtAnchorSubmit_setup($("SBOOKAPP"));
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
  var elt=$$(spec,template);
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
  if ($("SBOOKABOUT")) {
    fdjtReplace("APPABOUTCONTENT",$("SBOOKABOUT"));
    return;}
  var about=$("APPABOUT");
  var title=
    $("SBOOKTITLE")||
    fdjtGetMeta("SBOOKTITLE")||fdjtGetMeta("TITLE")||
    document.title;
  var byline=
    $("SBOOKBYLINE")||$("SBOOKAUTHOR")||
    fdjtGetMeta("SBOOKBYLINE")||fdjtGetMeta("BYLINE")||
    fdjtGetMeta("SBOOKAUTHOR")||fdjtGetMeta("AUTHOR");
  var copyright=
    $("SBOOKCOPYRIGHT")||
    fdjtGetMeta("SBOOKCOPYRIGHT")||fdjtGetMeta("COPYRIGHT")||
    fdjtGetMeta("RIGHTS");
  var publisher=
    $("SBOOKPUBLISHER")||
    fdjtGetMeta("SBOOKPUBLISHER")||
    fdjtGetMeta("PUBLISHER");
  var description=
    $("SBOOKDESCRIPTION")||
    fdjtGetMeta("SBOOKDESCRIPTION")||
    fdjtGetMeta("DESCRIPTION");
  var digitized=
    $("SBOOKDIGITIZED")||
    fdjtGetMeta("SBOOKDIGITIZED")||
    fdjtGetMeta("DIGITIZED");
  var sbookified=$("SBOOKIFIED")||fdjtGetMeta("SBOOKIFIED");
  _sbookFillTemplate(about,".title",title);
  _sbookFillTemplate(about,".byline",byline);
  _sbookFillTemplate(about,".publisher",publisher);
  _sbookFillTemplate(about,".copyright",copyright);
  _sbookFillTemplate(about,".description",description);
  _sbookFillTemplate(about,".digitized",digitized);
  _sbookFillTemplate(about,".sbookified",sbookified);
  _sbookFillTemplate(about,".about",$("SBOOKABOUT"));
  var cover=fdjtGetLink("cover");
  if (cover) {
    var cover_elt=$$(".cover",about)[0];
    if (cover_elt) fdjtAppend(cover_elt,fdjtImage(cover));}
}

/* Previewing */

function sbookPreview(elt,offset)
{
  var cxt=false;
  // sbook_trace("sbookPreview",elt);
  if (!(elt)) 
    if (sbook_preview) {
      fdjtDropClass(document.body,"preview");
      fdjtDropClass(sbook_preview,"previewing");
      fdjtScrollRestore();
      sbook_preview=false;
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
  sbook_preview=elt;
  if ((elt.getAttribute) &&
      (elt.getAttribute("toclevel")) ||
      ((elt.sbookinfo) && (elt.sbookinfo.level)))
    cxt=false;
  else if (elt.sbook_head)
    cxt=elt.sbook_head;
  if (elt) fdjtScrollPreview(elt,cxt,offset);
}

function sbookStartPreview(evt)
{
  fdjtCancelEvent(evt);
  var ref=sbookGetRef($T(evt));
  if (ref) sbookPreview(ref);
}

function sbookStopPreview(evt)
{
  if (evt) fdjtCancelEvent(evt);
  window.setTimeout("sbookPreview(false);",100);
}

/* Button methods */

function sbookIndexButton_onclick(evt)
{
  evt=evt||event||null;
  if ((sbook_mode==="searching") || (sbook_mode==="browsing")) {
    sbookHUDMode(false);
    fdjtDropClass("SBOOKSEARCH","hover");
    $("SBOOKSEARCHTEXT").blur();}
  else {
    sbookHUDMode("searching");
    $("SBOOKSEARCHTEXT").focus();
    fdjtCancelEvent(evt);}
}

function sbookTOCButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="toc") {
    sbookHUDMode(false);
    fdjtDropClass("SBOOKTOC","hover");}
  else sbookHUDMode("toc");
  fdjtCancelEvent(evt);
}

function sbookHelpButton_onclick(evt)
{
  if (sbook_mode==="help") sbookHUDMode(false);
  else {
    sbookHUDMode("help");
    fdjtDropClass(document.body,"sbooknovice");}
  fdjtCancelEvent(evt);
}

function sbookAppButton_onclick(evt)
{
  if (sbook_mode)
    if (fdjtContains(sbook_apps,sbook_mode))
      sbookHUDMode(false);
    else sbookHUDMode(sbook_last_app);
  else sbookHUDMode(sbook_last_app);
  fdjtCancelEvent(evt);
}

function sbookLoginButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="login") sbookHUDMode(false);
  else sbookHUDMode("login");
  evt.cancelBubble=true;
}

function sbookRightEdge_onclick(evt)
{
  fdjtTrace("Right edge click %o",evt);
  sbookHUDMode(false);
  if (sbook_edge_taps) sbookForward();
  fdjtCancelEvent(evt);
}

function sbookLeftEdge_onclick(evt)
{
  sbookHUDMode(false);
  if (sbook_edge_taps) sbookBackward();
  fdjtCancelEvent(evt);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
