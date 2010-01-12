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

// Where graphics can be found
var sbook_graphics_root="http://static.beingmeta.com/graphics/";

function createSBOOKHUD()
{
  var hud=$("SBOOKHUD");
  if (hud) return hud;
  else {
    var help_button=
      fdjtImage("http://static.beingmeta.com/graphics/HelpIcon40x40.png",
		".button.help","?","help");
    var login_button=
      fdjtImage("http://static.beingmeta.com/graphics/sbookslogo40x40.png",
		".button.login","?","login");
    help_button.onclick=sbookHelpButton_onclick;
    login_button.onclick=sbookLoginButton_onclick;
    hud=fdjtDiv
      ("#SBOOKHUD.hud",
       fdjtDiv("#SBOOKTOC.hudblock.hud"),
       fdjtDiv("#SBOOKFEEDS.hudblock.hud",login_button,help_button),
       fdjtDiv("#SBOOKGLOSSES.hudblock.hud"),
       fdjtDiv("#SBOOKSEARCH.hudblock.hud"),
       fdjtDiv("#SBOOKRIGHTMARGIN.hud"),
       fdjtDiv("#SBOOKTAGS.hudblock.hud.tags"),
       sbookCreateAppHUD());

    hud.title="";
    hud.onclick=sbookHUD_onclick;
    hud.onmouseover=sbookHUD_onmouseover;
    hud.onmouseout=sbookHUD_onmouseout;

    sbookHUD=hud;

    fdjtPrepend(document.body,hud);

    if (sbook_head) sbookSetHead(sbook_head);

    return hud;}
}

function sbookInitNavHUD()
{
  fdjtReplace("SBOOKTOC",sbookCreateNavHUD());
  var toc_button=
    fdjtImage(sbook_graphics_root+"CompassIcon40x40.png","hudbutton","toc",
	      "navigate table of contents");
  toc_button.onclick=sbookTOCButton_onclick;
  toc_button.onmouseover=fdjtClassAdder("SBOOKTOC","hover");
  toc_button.onmouseout=fdjtClassDropper("SBOOKTOC","hover");
  fdjtPrepend(sbookHUD,toc_button);
}

function sbookInitSocialHUD()
{
  fdjtReplace("SBOOKGLOSSES",sbookCreateGlossesHUD());
  fdjtReplace("SBOOKFEEDS",sbookCreateFeedHUD());
}

function sbookInitSearchHUD()
{
  fdjtReplace("SBOOKSEARCH",sbookCreateSearchHUD());
  var index_button=
    fdjtImage(sbook_graphics_root+"TagSearch40x40.png","hudbutton","index",
	      "search the content using semantic tags");
  index_button.onclick=sbookIndexButton_onclick;
  index_button.onmouseover=fdjtClassAdder("SBOOKSEARCH","hover");
  index_button.onmouseout=fdjtClassDropper("SBOOKSEARCH","hover");
  fdjtPrepend(sbookHUD,index_button);
}


/* Mode controls */

var sbookHUD_displaypat=/(hudup)|(hudresults)|(hudglosses)/g;
var sbookHUDMode_pat=
  /(app)|(searching)|(browsing)|(toc)|(glosses)|(mark)|(minimal)/g;

function sbookHUDMode(mode)
{
  if (sbook_trace_hud)
    fdjtLog("sbookHUDMode %o, cur=%o dbc=%o",
	    mode,sbook_mode,document.body.className);
  if (mode) {
    if (mode===true) mode="minimal";
    sbook_mode=mode;
    fdjtAddClass(document.body,"hudup");
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);}
  else {
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

function sbookPreviewLocation(elt)
{
  var topbar=$("SBOOKTOP");
  var spanbar=$$(".spanbar",topbar)[0];
  if (spanbar) {
    var progress=$$(".progressbox",topbar)[0];
    var width=spanbar.ends-spanbar.starts;
    var ratio=(elt.sbookloc-spanbar.starts)/width;
    progress.style.left=((Math.round(ratio*10000))/100)+"%";}
}

function sbookPreview(elt,nomode)
{
  var cxt=false;
  // sbook_trace("sbookPreview",elt);
  if (elt===false) return sbookStopPreview();
  /* No longer needed with TOC at the bottom */
  var offset=sbookDisplayOffset();
  sbook_preview=true;
  sbookPreviewLocation(elt);
  if ((elt.getAttribute) &&
      (elt.getAttribute("toclevel")) ||
      ((elt.sbookinfo) && (elt.sbookinfo.level)))
    cxt=false;
  else if (elt.sbook_head)
    cxt=elt.sbook_head;
  if (elt) fdjtScrollPreview(elt,cxt,offset);
  if (!(nomode)) fdjtAddClass(document.body,"preview");
}
function sbookPreviewNoMode(elt)
{
  return sbookPreview(elt,true);
}

function sbookPreview_onmouseover(evt)
{
  evt=evt||event||null;
  var target=$T(evt); var ref;
  while (target)
    if (target.sbook_ref) break;
    else if (target.getAttribute("PREVIEW")) break;
    else target=target.parentNode;
  if (!(target)) return;
  else if (typeof target.sbook_ref === "string")
    ref=$(target.sbook_ref);
  else if (target.sbook_ref)
    ref=target.sbook_ref;
  else ref=$(target.getAttribute("PREVIEW"));
  if (!(ref)) return;
  fdjtDelayHandler(300,sbookPreview,ref,document.body,"preview");
}

function sbookPreview_onmouseout(evt)
{
  evt=evt||event||null;
  fdjtDelayHandler(300,sbookPreview,false,document.body,"preview");
}

function sbookPreview_onclick(evt)
{
  evt=evt||event||null;
  var target=$T(evt); var ref;
  while (target)
    if (target.sbook_ref) break;
    else if (target.getAttribute("PREVIEW")) break;
    else target=target.parentNode;
  if (!(target)) return;
  else if (typeof target.sbook_ref === "string")
    ref=$(target.sbook_ref);
  else if (target.sbook_ref)
    ref=target.sbook_ref;
  else ref=$(target.getAttribute("PREVIEW"));
  if (!(ref)) return;
  sbookScrollTo(ref);
}

function sbookSetPreview(flag)
{
  if (flag) fdjtAddClass(document.body,"preview");
  else fdjtDropClass(document.body,"preview");
}

function sbookStopPreview(ignored)
{
  fdjtScrollRestore();
  fdjtDropClass(document.body,"preview");
  window.setTimeout("sbook_preview=false;",100);
}

// What to use as the glossmark image URI.  This 'image' 
//  really invokes a script to pick or generate a
//  image for the current user and document.
var sbook_glossmark_img="sBooksWE_32x32.png";
function sbook_glosses_icon(uri)
{
  return sbook_webglosses_root+"glossmarks/"+sbook_glossmark_img+
    ((uri) ? ("?URI="+encodeURIComponent(uri)) : "");
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
      evt.cancelBubble=true;
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
  div.innerHTML=sbook_helptext;
  fdjtDelayHandler(1500,sbookUpdateAppHUD,false,sbook_root);
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
}

/* The TOC head */

function sbookTOC_onmouseover(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookTOC_onmouseover",evt);
  var target=sbookGetRef($T(evt));
  if (!((sbook_mode)||(fdjtHasClass(document.body,"hudup")))) return;
  sbookHUD_onmouseover(evt);
  fdjtCoHi_onmouseover(evt);
  if (target===null) return;
  var head=sbookGetHead(target);
  if (head)
    fdjtDelayHandler(250,sbookPreviewNoMode,head,
		     document.body,"previewing");
}

function sbookTOC_onmouseout(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookTOC_onmouseout",evt);
  sbookHUD_onmouseout(evt);
  fdjtCoHi_onmouseout(evt);
  fdjtDelayHandler(250,sbookStopPreview,false,document.body,"previewing");
  var rtarget=evt.relatedTarget;
  if (!(rtarget)) return;
  while (rtarget)
    if (rtarget===sbookHUD) return;
    else if (rtarget===document.body) break;
    else if (rtarget===window) break;
    else if (rtarget===document) break;
    else try {rtarget=rtarget.parentNode;}
      catch (e) {break;}
  sbook_hud_forced=false;
}

function sbookTOC_onclick(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbookTOC_onclick",evt);
  var target=sbookGetRef($T(evt));
  if (target===null) {
    sbookHUDToggle("toc");
    return;}
  sbook_preview=false;
  fdjtScrollDiscard();
  if (evt.preventDefault) evt.preventDefault(); else evt.returnValue=false;
  evt.cancelBubble=true;
  sbookSetHead(target);
  var info=sbook_getinfo(target);
  sbookScrollTo(target);
  if (!((info.sub) && ((info.sub.length)>2)))
    sbookHUDMode(false);
  sbookSetTarget(target);
  return false;
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
    evt.cancelBubble=true;}
}

function sbookTOCButton_onclick(evt)
{
  evt=evt||event||null;
  if (sbook_mode==="toc") {
    sbookHUDMode(false);
    fdjtDropClass("SBOOKTOC","hover");}
  else sbookHUDMode("toc");
  evt.cancelBubble=true;
}

function sbookHelpButton_onclick(evt)
{
  if ((sbook_mode==="app")&&
      (fdjtSelectedTab("SBOOKTABS")==="APPHELP")) {
    sbookHUDMode(false);
    return;}
  evt=evt||event||null;
  sbookHUDMode("app");
  fdjtSelectTab('SBOOKTABS','APPHELP');
  evt.cancelBubble=true;
}

function sbookLoginButton_onclick(evt)
{
  if ((sbook_mode==="app")&&
      (fdjtSelectedTab("SBOOKTABS")==="APPLOGIN")) {
    sbookHUDMode(false);
    return;}
  evt=evt||event||null;
  sbookHUDMode("app");
  fdjtSelectTab('SBOOKTABS','APPLOGIN');
  evt.cancelBubble=true;
}

/* Other stuff */

/* This initializes the HUD state to the initial location with the
   document, using the hash value if there is one. */ 
function sbookHUD_Init()
{
  var hash=window.location.hash, target=sbook_root;
  if ((typeof hash === "string") && (hash.length>0)) {
    if ((hash[0]==='#') && (hash.length>1))
      target=sbook_hashmap[hash.slice(1)];
    else target=sbook_hashmap[hash];}
  else if (window.scrollY) {
    var scrollx=window.scrollX||document.body.scrollLeft;
    var scrolly=window.scrollY||document.body.scrollTop;
    var xoff=scrollx+sbook_last_x;
    var yoff=scrolly+sbook_last_y;
    var scroll_target=sbookGetXYFocus(xoff,yoff);
    if (scroll_target) target=scroll_target;}
  if (!(target)) target=sbook_root;
  if ((target!==sbook_root)||(target!==document.body)) {
    target.scrollIntoView();
    sbookTrackFocus(target)}
  // fdjtTrace("at init target=%o loc=%o",target,target.sbookloc);
  // This forces it to reload in some browsers, so don't do it
  // window.location=window.location;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
