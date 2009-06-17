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
// Whether the HUD is up
var sbook_hudup=false;
// The selected HUD function
var sbook_hudfcn=false;
// Whether the HUD state was forced
var sbookHUD_forced=false;

// The keycode for bringing the HUD up and down
var sbook_hudkey=27;
// Whether we are previewing a section
var sbook_saved_scrollx=false, sbook_saved_scrolly=false;

// Where graphics can be found
var sbook_graphics_root="/static/graphics/";

function createSBOOKHUD()
{
  var hud=$("SBOOKHUD");
  if (hud) return hud;
  else {
    hud=fdjtDiv
      ("#SBOOKHUD",
       sbookMode("SBOOKTOCBUTTON","CompassIcon32x32.png","toc",
		 _("navigate this sBook")),
       sbookMode("SBOOKSEARCHBUTTON","SearchIcon32.png","search",
		 _("search this sBook")));
    fdjtAppend(hud,
	       fdjtDiv("#SBOOKTOC"),
	       createSBOOKHUDsearch(),
	       createSBOOKHUDsocial());

    hud.onclick=sbookHUD_onclick;
    /*
    hud.onmouseover=sbookHUD_onmouseover;
    hud.onmouseout=sbookHUD_onmouseout;
    */
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
  if (title) img.title=title;
  return img;
}

/* Mode controls */

var sbookHUD_displaypat=/(hudhover)|(hudup)|(hudresults)|(hudechoes)/g;

function sbookSetHUD(display,fcn,forced)
{
  var body=document.body;
  /*
  fdjtTrace("sbookSetHUD %s/%s/%o: body=%s, hud=%s",
	    display,fcn,forced,body.className,sbookHUD.className);
  */
  if (display)
    if (display===true)
      fdjtSwapClass(body,sbookHUD_displaypat,"hudup");
    else fdjtSwapClass(body,sbookHUD_displaypat,display);
  else fdjtDropClass(body,sbookHUD_displaypat);
  if (fcn) {
    var oldfcn=sbookHUD.className;
    if ((display) && (fcn!==oldfcn)) {
      var hudelt=fdjtGetChildrenByClassName(fcn);
      if ((hudelt) && (hudelt.length>0)) hudelt[0].focus();}
    sbook_hudfcn=fcn;
    sbookHUD.className=fcn;}
  if (forced) sbook_hud_forced=true;
  else sbook_hud_forced=false;
  if (fdjtHasClass(body,"hudup")) sbook_hudup=true;
  else sbook_hudup=false;
  /*
  fdjtTrace("sbookSetHUD %s/%s/%o: body=%s, hud=%s",
	    display,fcn,forced,body.className,sbookHUD.className);
  */
}

function sbookModeButton_onclick(evt,mode)
{
  var body=document.body;
  // fdjtTrace("mode button click %o %o",evt,mode);
  if (sbookHUD.className===mode)
    if (sbook_hudup) sbookSetHUD(false);
    else sbookSetHUD(true);
  else sbookSetHUD(true,mode,true);
  fdjtDropClass(body,"preview");
  if (evt) {
    evt.target.blur();
    evt.preventDefault();
    evt.cancelBubble=true;}
  if (sbook_hudup) {
    var head_elt=fdjtGetChildrenByClassName(sbookHUD,"sbook"+mode);
    if ((head_elt) && (head_elt.length>0)) {
      head_elt[0].focus();
      if (head_elt[0].onfocus) head_elt[0].onfocus(false);}
    return false;}
}

function sbookPreviewOffset()
{
  if (sbook_hudup) {
    var fcn=sbookHUD.className;
    var elt=fdjtGetChildrenByClassName(sbookHUD,"sbook"+fcn);
    if ((elt) && (elt.length>0))
      return elt[0].offsetHeight||60;
    else return 60;}
  else return 60;
}

function sbookPreview(elt,nomode)
{
  var offset=sbookPreviewOffset();
  if (elt) fdjtScrollPreview(elt,false,-offset);
  if (!(nomode)) fdjtAddClass(document.body,"preview");
}

function sbookStopPreview(elt)
{
  fdjtScrollRestore();
  fdjtDropClass(document.body,"preview");
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

function sbookHUD_onhover(hover)
{
  if (sbook_hudup) return;
  fdjtTrace("sbookHUD_onhover");
  if (hover)
    fdjtAddClass(document.body,"hudhover");
  else {
    fdjtDropClass(document.body,"hudhover");
    if (sbook_hudup) sbookSetHUD(false);}
}

function sbookHUD_onmouseover(evt)
{
  if (sbook_hudup) return;
  fdjtTrace("sbookHUD_onmouseover");
  if (evt.target)
    fdjtDelayHandler(100,sbookHUD_onhover,true,sbookHUD,"hudhover");
  evt.cancelBubble=true;
}

function sbookHUD_onmouseout(evt)
{
  var target=evt.target;
  if (evt.target)
    if (sbook_hudup)
      fdjtDelayHandler(100,sbookHUD_onhover,false,sbookHUD,"hudhover");
    else fdjtDelayHandler(100,sbookHUD_onhover,false,sbookHUD,"hudhover");
}

function sbookHUD_onclick(evt)
{
  var target=evt.target;
  while (target)
    if ((target.tagName==="A") || (target.tagName==="INPUT") ||
	(target.onclick) || (target.hasAttribute("onclick")))
      return;
    else target=target.parentNode;
  if (sbook_hudup)
    sbookSetHUD(false);
  else sbookSetHUD(true,false,true);
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
  if (!(sbook_hudup)) return;
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  var head=target.headelt;
  if (head) sbookPreview(head,true);
  evt.cancelBubble=true;
  evt.preventDefault();
}

function sbookTOC_onmouseout(evt)
{
  fdjtScrollRestore();
  fdjtDropClass(document.body,"preview");
  evt.cancelBubble=true;
  evt.preventDefault();
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

function sbookTOC_onmouseout(evt)
{
  fdjtScrollRestore();
  fdjtDropClass(document.body,"preview");
  evt.cancelBubble=true;
  evt.preventDefault();
  var rtarget=evt.relatedTarget;
  if (!(rtarget)) return;
  try {
    if (rtarget.ownerDocument!=document) {
      fdjtDelayHandler(300,sbookSetHUD,false,document,"hidehud");
      return;}
    // We'll get an error if we go out of the document,
    // in which case we probably want to hide anyway
    while (rtarget)
      if (rtarget===sbookHUD) return;
      else if (rtarget===document.body) break;
      else rtarget=rtarget.parentNode;}
  catch (e) {
    sbook_hud_forced=false;
    fdjtDelayHandler(300,sbookSetHUD,false,document,"hidehud");
    return;}
  sbook_hud_forced=false;
}

function sbookTOC_onclick(evt)
{
  var target=sbook_get_headelt(evt.target);
  if (target===null) return;
  if ((!(sbook_hudup)) && ((evt.ctrlKey)||(evt.altKey)||(evt.shiftKey))) {
    sbookSetHUD(true);
    return;}
  else if ((!(target.headelt)) && (!(sbook_hudup))) {
    sbookSetHUD(true);
    return;}
  evt.preventDefault();
  evt.cancelBubble=true;
  sbookSetHead(target.headelt);
  var info=sbook_getinfo(target.headelt);
  sbookScrollTo(target.headelt);
  if (!((info.sub) && ((info.sub.length)>2)))
    sbookSetHUD(false);
  return false;
}

/* Other stuff */

function sbookHUD_unhighlight(elt_arg)
{
  var elt=((elt_arg) || sbookHUD_highlighted_elt);
  if (elt) {
    var alt=((elt._sbook_span_elt) || (elt._sbook_name_elt) || (false));
    fdbDropClass(elt,"highlighted");}
}

function sbookHUD_Next(evt)
{
  var curinfo=sbook_head.sbookinfo;
  var goto=curinfo.next;
  if (!(goto)) goto=curinfo.sbook_head.sbookinfo.next;
  if (goto) {
    sbookSetHead(goto);
    sbookScrollTo(goto);}
  if (evt) evt.cancelBubble=true;
  sbookSetHUD(false);
}

function sbookHUD_Prev(evt)
{
  var curinfo=sbook_head.sbookinfo;
  var goto=curinfo.prev;
  if (!(goto)) goto=curinfo.sbook_head.sbookinfo.prev;
  if (goto) {
    sbookSetHead(goto);
    sbookScrollTo(goto);}
  if (evt) evt.cancelBubble=true;
  sbookSetHUD(false);
}

/* This initializes the HUD state to the initial location with the
   document, using the hash value if there is one. */ 
function sbookHUD_Init()
{
  var hash=window.location.hash, target=document.body;
  if ((typeof hash === "string") && (hash.length>0)) {
    if ((hash[0]==='#') && (hash.length>1))
      target=sbook_hashmap[hash.slice(1)];
    else target=sbook_hashmap[hash];}
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
