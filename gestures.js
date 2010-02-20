/* -*- Mode: Javascript; -*- */

var sbooks_gestures_id="$Id$";
var sbooks_gestures_version=parseInt("$Revision$".slice(10,-1));

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

/* Core gesture handling */

/* There are currently two interaction modes: browser and tablet.  In
   browser mode, clicking on a text or selecting a passage brings up
   the dialog for adding a gloss; in tablet mode (because the
   interaction is different), this process has two phases.  The first
   click or initial selection causes the passage to be 'selected'; the
   second click actually pulls up the dialog.

   Implementing these functions is a little tricky because of the
   interaction with text selection and the fact that mousedown (or
   click) normally clears the current text selection to start a new
   one.

   In browser mode, we open the dialog on mouse up, grabbing any
   selected text.  In tablet mode, we use the UI's "target" object to
   separate out the two phases.  On mouseup, we set the sbook target
   and on mousedown we open the dialog if the event target is the
   sbook target.
 */


var sbook_mousedown_x=false;
var sbook_mousedown_y=false;
var sbook_mousedown_tick=false;

var sbook_gesture_min=0.4;
var sbook_gesture_max=3;
var sbook_gq=18;

function sbook_onmousedown(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onmousedown",evt);
  // Track these no matter what
  sbook_mousedown_x=evt.screenX;
  sbook_mousedown_y=evt.screenY;
  sbook_mousedown_tick=fdjtTick();
  if ((evt.button>1)||(evt.ctrlKey)) return;
  var target=$T(evt);
  // Ignores clicks on the HUD
  if (sbookInUI(target)) return;
  else if (sbook_preview) {
    sbookStopPreview(evt);
    return;}
  // If the HUD is up, clicks on the content just hide the HUD
  else if ((sbook_mode)&&(sbook_mode!=="minimal")) {
    sbookHUDMode(false);
    return;}
  // Ignore clicks on text fields, anchors, inputs, etc
  else if (fdjtIsClickactive(target)) return;
  else if (fdjtHasParent(target,sbook_target)) {
    sbook_mark(sbook_target,false,fdjtSelectedText());
    fdjtCancelEvent(evt);
    return;}
  else {
    var focus=sbookGetFocus(target,evt.altKey);
    if (focus) {
      sbookSetTarget(focus);
      sbookHUDFlash("minimal");}
    else {
      sbookSetTarget(false);
      sbookHUDMode(false);}}
}
function sbook_onmouseup(evt)
{
  evt=evt||event||null;
  sbookHUDFlash(false,1000);
}

function sbook_ondblclick(evt)
{
  evt=evt||event||null;
  var target=sbookGetFocus($T(evt),evt.altKey);
  if (target) {
    sbookSetTarget(target);
    sbook_mark(target,false,fdjtSelectedText());
    return;}
}

function sbookHandleGestures(evt)
{
  var x=evt.screenX; var y=evt.screenY; var tick=fdjtTick();
  var dx=x-sbook_mousedown_x; var dy=y-sbook_mousedown_y;
  var dt=tick-sbook_mousedown_tick;
  if (sbook_trace_gestures) 
    fdjtTrace("x=%o y=%o tick=%o dx=%o dy=%o dt=%o",
	      x,y,tick,dx,dy,dt);
  if ((dt>sbook_gesture_min)&&(dt<sbook_gesture_max)) {
    var absdx=((dx<0)?(-dx):(dx)); var absdy=((dy<0)?(-dy):(dy));
    var horizontal=((dx>sbook_gq)?(1):(dx<-sbook_gq)?(-1):(0));
    var vertical=((dy>sbook_gq)?(1):(dy<-sbook_gq)?(-1):(0));
    if (sbook_trace_gestures)
      fdjtTrace("absdx=%o absdy=%o v=%o h=%o",
		absdx,absdy,vertical,horizontal);
    if ((horizontal===0)&&(vertical===0)) sbook_mark($T(evt));
    else if (absdy<(3*sbook_gq))
      if (horizontal>0) sbookNextPage(evt);
      else if (horizontal<0) sbookPrevPage(evt);
      else {}
    else if (absdx<(3*sbook_gq))
      if (vertical>0) sbookNextSection(evt);
      else if (vertical<0) sbookPrevSection(evt);
      else {}
    else {}
    fdjtCancelEvent(evt);}
}

function sbookTabletMode(flag)
{
  if (flag) {
    sbook_edge_taps=true;
    sbook_tablet=true;
    sbook_gestures=false;
    fdjtSetCookie("sbooktablet","yes",false,"/");
    fdjtAddClass(document.body,"tablet");}
  else {
    sbook_edge_taps=false;
    sbook_tablet=false;
    sbook_gestures=false;
    fdjtClearCookie("sbooktablet","/");
    fdjtDropClass(document.body,"tablet");}
}

function sbookSparseMode(flag)
{
  if (flag) {
    sbook_sparse=true;
    $("SBOOKSPARSE").checked=true;
    fdjtSetCookie("sbooksparse","yes",false,"/");
    fdjtAddClass(document.body,"sparsebook");}
  else {
    sbook_sparse=false;
    $("SBOOKSPARSE").checked=false;
    fdjtClearCookie("sbooksparse","/");
    fdjtDropClass(document.body,"sparsebook");}
}

function sbookNoHUDFlash(flag)
{
  fdjtTrace("sbooknohudflash %o",flag);
  if (flag) sbook_hud_flash=false;
  else sbook_hud_flash=2000;
}

/* Dead (sleeping?) code */

/*
function sbook_onmouseup(evt)
{
  evt=evt||event||null;
  var target=$T(evt); var focus=false;
  // sbook_trace("sbook_onmouseup",evt);
  // When to ignore the mouseup
  if ((evt.button>1)||
      (sbook_simple_select)||
      (sbook_2phase_select)||
      (fdjtIsClickactive(target))||
      (sbookInUI(target))) {
    sbook_mousedown_x=false;
    sbook_mousedown_y=false;
    sbook_mousedown_tick=false;
    return;}
  // This click on the content just hides the HUD
  if ((sbook_mode)&&(sbook_mode!=="minimal")) {
    sbookHUDMode(false);
    fdjtCancelEvent(evt);
    return;}
  else if (!(focus=sbookGetFocus(target))) {
    sbook_mousedown_x=false;
    sbook_mousedown_y=false;
    sbook_mousedown_tick=false;
    return;}
  else if ((sbook_gestures)&&(sbook_mousedown_tick))
    sbookHandleGestures(evt);
  else if (sbook_2phase_select)
    sbookSetTarget(focus);
  else {
    var text=fdjtSelectedText();
    sbook_mark(focus,false,text);
    fdjtCancelEvent(evt);}
}

function sbook_onclick(evt)
{
  // Non-simple select is handled by onmousedown and onmouseup
  if (!(sbook_simple_select)) return;
  evt=evt||event||null;
  if (evt.button>1) return;
  // sbook_trace("sbook_onclick",evt);
  var target=$T(evt);
  // Don't override anchors, input, etc
  if (fdjtIsClickactive(target)) return;
  else if (sbookInUI(target)) return;
  // If you're clicking on the selected target, mark it
  // Note that this isn't normally the path to marking, since
  // we catch the on mousedown to avoid resetting the selection
  if (sbook_mode) {
    // This just toggles the HUD off
    sbookHUDMode(false);
    fdjtCancelEvent(evt);
    return;}
  var focus=sbookGetFocus(target);
  if (focus) {
    sbook_mark(focus);
    fdjtCancelEvent(evt);}
}
*/

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

