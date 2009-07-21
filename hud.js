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
// The selected HUD function
var sbook_hudfcn=false;
// Whether the HUD state was forced
var sbookHUD_forced=false;

// The keycode for bringing the HUD up and down
var sbook_hudkey=27;

// Where graphics can be found
var sbook_graphics_root="http://static.beingmeta.com/graphics/";

function createSBOOKHUD()
{
  var hud=$("SBOOKHUD");
  if (hud) return hud;
  else {
    hud=fdjtDiv
      ("#SBOOKHUD",
       fdjtDiv("#SBOOKTOC.sbooktoc.hud"),
       fdjtDiv("#SBOOKRESULTS.sbookresults.hud"),
       fdjtWithId(createSBOOKHUDsearch(),"SBOOKSEARCH"));
    hud.onclick=sbookHUD_onclick;
    hud.onmouseover=sbookHUD_onmouseover;
    hud.onmouseout=sbookHUD_onmouseout;
    sbookHUD=hud;
    fdjtPrepend(document.body,hud);
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

/* Mode controls */

var sbookHUD_displaypat=/(hudup)|(hudresults)|(hudechoes)/g;

var sbookHUDMode_pat=/(searching)|(browsing)|(toc)/g;

function sbookHUDMode(mode)
{
  if (mode) {
    sbook_hudup=mode;
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);}
  else {
    sbook_hudup=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);}
}
function sbookHUDToggle(mode)
{
  if (fdjtHasClass(sbookHUD,mode)) {
    sbook_hudup=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);}
  else if (mode) {
    sbook_hudup=mode;
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,mode);}
  else {
    sbook_hudup=false;
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);}
}

function sbookPreviewOffset()
{
  var toc=$("SBOOKTOC");
  if (toc) return toc.offsetHeight||60;
  else return 60;
}

function sbookPreview(elt,nomode)
{
  // sbook_trace_handler("sbookPreview",elt);
  var offset=sbookPreviewOffset();
  sbook_preview=true;
  if (elt) fdjtScrollPreview(elt,false,-offset);
  if (!(nomode)) fdjtAddClass(document.body,"preview");
}
function sbookPreviewNoMode(elt)
{
  return sbookPreview(elt,true);
}

function sbookPreview_onmouseover(evt)
{
  var target=evt.target;
  while (target)
    if (target.sbookelt) break;
    else target=target.parentNode;
  if (!(target)) return;
  var sbookelt=target.sbookelt;
  sbookPreview(sbookelt,true);
  fdjtAddClass(document.body,"preview");
}

function sbookPreview_onmouseout(evt)
{
  sbookStopPreview();
  fdjtDropClass(document.body,"preview");
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
  sbook_overhud=true;
}

function sbookHUD_onmouseout(evt)
{
  // sbook_trace_handler("sbookHUD_onmouseout",evt);
  sbook_overhud=false;
}

function sbookHUD_onclick(evt)
{
  var target=evt.target;
  while (target)
    if ((target.tagName==="A") || (target.tagName==="INPUT") ||
	(target.onclick) || (target.hasAttribute("onclick")))
      return;
    else target=target.parentNode;
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

/* TOC handlers */

function sbookTOC_onmouseover(evt)
{
  // sbook_trace_handler("sbookTOC_onmouseover",evt);
  var target=sbook_get_headelt(evt.target);
  sbookHUD_onmouseover(evt);
  fdjtCoHi_onmouseover(evt);
  if (target===null) return;
  var head=target.headelt;
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
  try {
    // We'll get an error if we go out of the document,
    // in which case we probably want to hide anyway
    while (rtarget)
      if (rtarget===sbookHUD) return;
      else if (rtarget===document.body) break;
      else if (rtarget===window) break;
      else if (rtarget===document) break;
      else rtarget=rtarget.parentNode;}
  catch (e) {}
  sbook_hud_forced=false;
}

var sbookTOCHighlighted=false;
var sbookTOCHighlights=false;

function sbookTOCHighlight(secthead)
{
  if (secthead===sbookTOCHighlighted) return;
  if (!(sbook_electric_spanbars)) return;
  if (sbookTOCHighlighted) {
    var highlights=sbookTOCHighlights;
    sbookTOCHighlighted=false;
    sbookTOCHighlights=null;
    var i=0; while (i<highlights.length) {
      var sect=highlights[i++]; 
      sect.style.color=null; sect.style.backgroundColor=null;}}
  var highlights=new Array();
  var sections=fdjtGetChildrenByClassName(sbookHUD,"sbookhudsect");
  var spanelts=fdjtGetChildrenByClassName(sbookHUD,"sbookhudspan");
  var i=0; while (i<sections.length) {
    var sect=sections[i++];
    if (sect.headelt===secthead) {
      sect.style.color='orange';
      highlights.push(sect);}}
  i=0; while (i<spanelts.length) {
    var sect=spanelts[i++];
    if (sect.headelt===secthead) {
      sect.style.backgroundColor='orange';
      highlights.push(sect);}}
  sbookTOCHighlighted=secthead;
  sbookTOCHighlights=highlights;
}

function sbookTOC_onclick(evt)
{
  // sbook_trace_handler("sbookTOC_onclick",evt);
  var target=sbook_get_headelt(evt.target);
  fdjtTrace("sbookTOC_onclick evt=%o target=%o he=%o",
	    evt,target,((target)&&(target.headelt)));
  if (target===null) {
    sbookHUDToggle("toc");
    return;}
  fdjtScrollDiscard();
  if (target===null) return;
  evt.preventDefault();
  evt.cancelBubble=true;
  sbookSetHead(target.headelt);
  var info=sbook_getinfo(target.headelt);
  sbookScrollTo(target.headelt);
  if (!((info.sub) && ((info.sub.length)>2)))
    sbookHUDMode(false);
  return false;
}

/* Results handlers */

function _sbookResults_onclick(evt)
{
  var target=evt.target;
  while (target)
    if (target.className==="searchresult") {
      fdjtScrollDiscard();
      sbookHUD.className=null;
      if (target.searchresult) {
	var elt=target.searchresult;
	var head=elt.sbook_head;
	if (head) sbookScrollTo(elt,head);
	else sbookScrollTo(elt);
	evt.preventDefault(); evt.cancelBubble=true;}
      else {
	evt.preventDefault(); 
	evt.cancelBubble=true;}
      return;}
    else target=target.parentNode;
}

function _sbookResults_onmouseover(evt)
{
  var target=evt.target;
  while (target)
    if (target.sbookelt) break;
    else target=target.parentNode;
  if (!(target)) return;
  var sbookelt=target.sbookelt;
  sbookPreview(sbookelt,true);
}

function _sbookResults_onmouseout(evt)
{
  sbookStopPreview();
}

/* Other stuff */

/* This initializes the HUD state to the initial location with the
   document, using the hash value if there is one. */ 
function sbookHUD_Init()
{
  var hash=window.location.hash, target=document.body;
  if ((typeof hash === "string") && (hash.length>0)) {
    if ((hash[0]==='#') && (hash.length>1))
      target=sbook_hashmap[hash.slice(1)];
    else target=sbook_hashmap[hash];}
  if (target) {
    sbook_focus=target; sbook_click_focus=target;}
  if (!(target))
    target=document.body;
  if (target!=document.body) target.scrollIntoView();
  sbookSetHead(target);
  if (target.sbookloc) sbookSetLocation(target.sbookloc);
  // window.location=window.location;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
