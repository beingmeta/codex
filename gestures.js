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

/*

  Preview behavior:
   click enables/disables preview mode, hold/release enables/disables
     preview mode
   clicking on the preview target while in preview mode jumps to the target
   shift acts just like the mouse button
  Body behavior:
   hold either temporarily hides the HUD or temporarily engages context mode
    (this might also be selecting some text)
   click when sbook_mode is non-context just drops the HUD
   click on a non-target makes it the target and enters context mode
   click on a target opens the mark HUD
  Marginal behavior:
   click on top or bottom margin, either hides HUD or engages last relevant
    mode
   click on left or right margin goes forward or backward
   hold on left or right margin auto-advances, springs back on release,
    stops on mouseout/touchout
     
  Handling hold with mouse:
   onmousedown enters mode, sets tick
   onmouseup leaves mode (unless shift is down)
   onmouseout leaves mode (unless shift or mouse is down)
     clears mouse_focus
   onmouseover shifts mode target when mode is live, sets mouse_focus on move
   shiftkey down enters mode on mouse_focus
   shiftkey up leaves mode (unless mousedown tick is set)

  Hold-free mode:
   click enters/leaves mode

*/

/* Core gesture handling */

/* There are currently two interaction modes: browser and touch.  In
   browser mode, clicking on a text or selecting a passage brings up
   the dialog for adding a gloss; in touch mode (because the
   interaction is different), this process has two phases.  The first
   click or initial selection causes the passage to be 'selected'; the
   second click actually pulls up the dialog.

   Implementing these functions is a little tricky because of the
   interaction with text selection and the fact that mousedown (or
   click) normally clears the current text selection to start a new
   one.

   In browser mode, we open the dialog on mouse up, grabbing any
   selected text.  In touch mode, we use the UI's "target" object to
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

function sbook_onclick(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onclick",evt);
  if (evt.button>1) return;
  var target=$T(evt);
  // Don't override anchors, input, etc
  if (fdjtIsClickactive(target)) return;
  else if (sbookInUI(target)) return;
  if (sbook_preview)
    // In preview mode, clicking turns off preview mode
    // and may jump to the click target if it's the preview
    // point
    if (fdjtHasParent(target,sbook_preview)) {
      sbookPreview(false);
      sbookSetTarget(target);}
    else sbookPreview(false);
  else if (sbook_mode) {
    // If the HUD is up, toggle it off
    sbookHUDMode(false);
    fdjtCancelEvent(evt);
    return;}
  else if ((sbook_target)&&(fdjtHasParent(target,sbook_target))) {
    sbook_mark(focus);
    fdjtCancelEvent(evt);}
  else {
    var focus=sbookGetFocus(target);
    sbookSetTarget(focus);}
}

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
  else if ((sbook_mode)&&(sbook_mode!=="context"))
    if (fdjtHasParent(target,sbook_target)) {
      sbookHUDMode("context");
      return;}
    else {
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
      sbookSetFocus(focus);
      sbookSetTarget(focus,false);
      sbookHUDMode("context");}
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
    sbookSetTarget(target,false);
    sbook_mark(target,false,fdjtSelectedText());
    return;}
}

/* Homegrown gesture recognition */

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

function sbookInterfaceMode(mode)
{
  if (mode==='touch') {
    sbook_touch=true;
    sbook_gestures=false;
    fdjtCheckSpan_set($("SBOOKTOUCHMODE"),true,true);
    fdjtAddClass(document.body,"touch");
    sbookCheckPagination();}
  else if (mode==='mouse') {
    sbook_touch=false;
    sbook_gestures=false;
    fdjtCheckSpan_set($("SBOOKMOUSEMODE"),true,true);
    fdjtDropClass(document.body,"touch");
    sbookCheckPagination();}
  else if (mode==='keyboard') {
    sbook_touch=false;
    sbook_gestures=false;
    fdjtCheckSpan_set($("SBOOKKBDMODE"),true,true);
    fdjtDropClass(document.body,"touch");
    sbookCheckPagination();}
  else {
    sbook_touch=false;
    sbook_gestures=false;
    fdjtDropClass(document.body,"touch");}
}

function sbookSparseMode(flag)
{
  if (flag) {
    sbook_sparse=true;
    fdjtCheckSpan_set($("SBOOKSPARSE"),true,true);
    fdjtAddClass(document.body,"sparsebook");}
  else {
    sbook_sparse=false;
    fdjtCheckSpan_set($("SBOOKSPARSE"),false,true);
    fdjtDropClass(document.body,"sparsebook");}
}

function sbookFlashMode(flag)
{
  if (flag) {
    fdjtCheckSpan_set($("SBOOKHUDFLASH"),true,true);
    sbook_hud_flash=sbook_default_hud_flash;}
  else {
    fdjtCheckSpan_set($("SBOOKHUDFLASH"),false,true);
    sbook_hud_flash=false;}
}

/* Setup */

function sbookGestureSetup()
{
  if (sbook_touch) sbookTouchGestureSetup();
  else sbookMouseGestureSetup();
}

function sbookMouseGestureSetup()
{
  // These are for mouse tracking
  window.onmouseover=sbook_onmouseover;
  window.onmousemove=sbook_onmousemove;
  window.onscroll=sbook_onscroll;
  // These are for gesture recognition and adding glosses
  window.onmousedown=sbook_onmousedown;
  window.onmouseup=sbook_onmouseup;
  // window.onclick=sbook_onclick;
  window.ondblclick=sbook_ondblclick;
  // For command keys
  window.onkeypress=sbook_onkeypress;
  window.onkeydown=sbook_onkeydown;
  window.onkeyup=sbook_onkeyup;
}

function sbookTouchGestureSetup()
{
  // These are for mouse tracking
  window.onscroll=sbook_onscroll;
  // These are for gesture recognition and adding glosses
  document.body.onclick=sbook_onclick;
  // For command keys, just in case
  window.onkeypress=sbook_onkeypress;
  window.onkeydown=sbook_onkeydown;
  window.onkeyup=sbook_onkeyup;
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

