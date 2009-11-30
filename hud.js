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
// This is the HUD where all echoes are displayed
var sbookEchoesHUD=false;
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
    var index_button=
      fdjtImage(sbook_graphics_root+"SearchIcon40x40.png","hudbutton","index");
    var toc_button=
      fdjtImage(sbook_graphics_root+"CompassIcon40x40.png","hudbutton","toc");
    var echobar=sbookCreateEchoBar("#SBOOKECHOES.echobar.hudblock.hud");
    hud=fdjtDiv
      ("#SBOOKHUD",index_button,toc_button,
       fdjtDiv("#SBOOKLOC.hudblock.hud",_sbook_generate_spanbar(document.body)),
       sbookCreateNavHUD(),
       fdjtWithId(createSBOOKHUDsearch(),"SBOOKSEARCH"),
       fdjtDiv("#SBOOKRIGHTMARGIN.hud"),
       sbookCreateHelpHUD(),
       echobar);
    hud.title="";
    index_button.onclick=function(evt){
      if ((sbook_mode==="searching") || (sbook_mode==="browsing")) {
	sbookHUDMode(false);
	fdjtDropClass("SBOOKSEARCH","hover");
	$("SBOOKSEARCHTEXT").blur();}
      else {
	sbookHUDMode("searching");
	$("SBOOKSEARCHTEXT").focus();
	evt.cancelBubble=true;}};
    index_button.onmouseover=function(evt) {
      fdjtAddClass("SBOOKSEARCH","hover");};
    index_button.onmouseout=function(evt) {
      fdjtDropClass("SBOOKSEARCH","hover");};

    toc_button.onclick=function(evt){
      if (sbook_mode==="toc") {
	sbookHUDMode(false);
	fdjtDropClass("SBOOKTOC","hover");}
      else sbookHUDMode("toc");
      evt.cancelBubble=true;}
    toc_button.onmouseover=function(evt) {
      fdjtAddClass("SBOOKTOC","hover");};
    toc_button.onmouseout=function(evt) {
      fdjtDropClass("SBOOKTOC","hover");};

    hud.onclick=sbookHUD_onclick;
    hud.onmouseover=sbookHUD_onmouseover;
    hud.onmouseout=sbookHUD_onmouseout;

    sbookHUD=hud;
    fdjtPrepend(document.body,hud);
    $("SBOOKECHOES").onclick=sbookEchoBar_onclick;
    $("SBOOKHIDEHELP").checked=(!(sbook_help_on_startup));
    return hud;}
}

function sbookMode(id,graphic,mode,title)
{
  var imgsrc=
    (((graphic.search("http")===0) || (graphic.search("/")===0)) ? (graphic) :
     (sbook_graphics_root+"/"+graphic));
  // Use ID as ALT text
  var img=fdjtImage(imgsrc,false,id);
  img.id=id; img.className="button";
  img.onclick=function(evt) {
    sbookModeButton_onclick(evt,mode);}
  img.onmouseover=function(evt) {
    sbookModeButton_onmouseover(evt,mode);};
  img.onmouseout=sbookModeButton_onmouseout;
  if (title) img.title=title;
  return img;
}

/* Determines how far below the top edge to naturally scroll.
   This ties to avoid the HUD, in case it is up. */
function sbookDisplayOffset()
{
  var toc=$("SBOOKTOC");
  if (toc) return -((toc.offsetHeight||60)+15);
  else return -60;
}

function sbookScrollTo(elt,cxt)
{
  fdjtClearPreview();
  if (elt.sbookloc) sbookSetLocation(elt.sbookloc);
  sbookSetFocus(elt);
  if ((elt.getAttribute) &&
      (elt.getAttribute("toclevel")) ||
      ((elt.sbookinfo) && (elt.sbookinfo.level)))
    sbookSetHead(elt);
  else if (elt.sbook_head)
    sbookSetHead(elt.sbook_head);
  if ((!cxt) || (elt===cxt))
    fdjtScrollTo(elt,sbookGetStableId(elt),false,true,sbookDisplayOffset());
  else fdjtScrollTo(elt,sbookGetStableId(elt),cxt,true,sbookDisplayOffset());
}

/* Mode controls */

var sbookHUD_displaypat=/(hudup)|(hudresults)|(hudechoes)/g;
var sbookHUDMode_pat=/(help)|(searching)|(browsing)|(toc)|(echoes)|(ping)/g;

function sbookHUDMode(mode)
{
  if (sbook_trace_hud)
    fdjtLog("sbookHUDMode %o, cur=%o dbc=%o",
	    mode,sbook_mode,document.body.className);
  if (mode) {
    sbook_mode=mode;
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);}
  else {
    sbook_mode=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);
    fdjtDropClass(sbookHUD,"hudup");}
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

function sbookHUDHover_onmouseover(evt)
{
  if (sbook_mode) return;
  fdjtAddClass(document.body,"hudhover");
}

function sbookHUDHover_onmouseout(evt)
{
  fdjtDropClass(document.body,"hudhover");
}

function sbookPreview(elt,nomode)
{
  var cxt=false;
  // sbook_trace_handler("sbookPreview",elt);
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
  fdjtDelayHandler(300,sbookPreview,false,document.body,"preview");
}

function sbookPreview_onclick(evt)
{
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

// What to use as the podspot image URI.  This 'image' 
//  really invokes a script to pick or generate a
//  image for the current user and document.
var sbook_podspot_img="sBooksWE_32x32.png";
function sbook_echoes_icon(uri)
{
  return sbook_webechoes_root+"podspots/"+sbook_podspot_img+
    ((uri) ? ("?URI="+encodeURIComponent(uri)) : "");
}

/* Handlers */

function sbookHUD_onmouseover(evt)
{
  // sbook_trace_handler("sbookHUD_onmouseover",evt);
  if (sbook_mode) evt.cancelBubble=true;
}

function sbookHUD_onmouseout(evt)
{
  // sbook_trace_handler("sbookHUD_onmouseout",evt);
  if (sbook_mode) evt.cancelBubble=true;
}

function sbookHUD_onclick(evt)
{
  // sbook_trace_handler("sbookHUD_onclick",evt);
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
  fdjtTrace("In HUD click, evt.shiftkey=%o",evt.shiftKey);
  if (evt.shiftKey) evt.preventDefault();
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

/* The Help HUD */

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

function sbookCreateHelpHUD(eltspec)
{
  var div=fdjtDiv(eltspec||"#SBOOKHELP");
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
  var hidehelp=fdjtGetChildrenByClassName(div,'helphider')[0];
  var dohidehelp=fdjtGetCookie("sbookhidehelp");
  if (dohidehelp) hidehelp.checked=true;
  else hidehelp.checked=false;
  hidehelp.onchange=function(evt){
    fdjtTrace("change on %o: %o checked=%o",hidehelp,evt,hidehelp.checked);
    if (hidehelp.checked)
      fdjtSetCookie("sbookhidehelp",true,false,"/",document.location.host);
    else fdjtClearCookie("sbookhidehelp","/",document.location.host);};
  return div;
}

/* The TOC head */

function sbookCreateNavHUD(eltspec)
{
  var toc_div=sbookTOCDiv(sbook_getinfo(sbook_root));
  var div=fdjtDiv(eltspec||"#SBOOKTOC.hudblock.hud",toc_div);
  div.onmouseover=sbookTOC_onmouseover;
  div.onmouseout=sbookTOC_onmouseout;
  div.onclick=sbookTOC_onclick;
  if (!(eltspec)) sbookNavHUD=div;
  return div;
}

function sbookTOC_onmouseover(evt)
{
  // sbook_trace_handler("sbookTOC_onmouseover",evt);
  var target=sbook_get_reftarget($T(evt));
  if (!((sbook_mode)||(fdjtHasClass(sbookHUD,"hudup")))) return;
  sbookHUD_onmouseover(evt);
  fdjtCoHi_onmouseover(evt);
  if (target===null) return;
  var head=document.getElementById(target.sbook_ref);
  if (head)
    fdjtDelayHandler(250,sbookPreviewNoMode,head,
		     document.body,"previewing");
}

function sbookTOC_onmouseout(evt)
{
  // sbook_trace_handler("sbookTOC_onmouseout",evt);
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
  // sbook_trace_handler("sbookTOC_onclick",evt);
  var target=sbook_get_reftarget($T(evt));
  var headelt=((target)&&(document.getElementById(target.sbook_ref)));
  if (headelt===null) {
    sbookHUDToggle("toc");
    return;}
  sbook_preview=false;
  fdjtScrollDiscard();
  evt.preventDefault();
  evt.cancelBubble=true;
  sbookSetHead(headelt);
  var info=sbook_getinfo(headelt);
  sbookScrollTo(headelt);
  if (!((info.sub) && ((info.sub.length)>2)))
    sbookHUDMode(false);
  sbookSetTarget(headelt);
  return false;
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
    var scrolly=window.scrollY||document.body.scrollLeft;
    var xoff=scrollx+sbook_last_x;
    var yoff=scrolly+sbook_last_y;
    var scroll_target=sbookGetXYFocus(xoff,yoff);
    if (scroll_target) target=scroll_target;}
  sbookSetTarget(target);
  if (!(target))
    target=sbook_root;
  if (target!==document.body) {
    target.scrollIntoView();
    sbookSetFocus(target)}
  // fdjtTrace("at init target=%o loc=%o",target,target.sbookloc);
  // This forces it to reload in some browsers, so don't do it
  // window.location=window.location;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
