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

/* Getting the target for a touch operation */

function sbookTouchTarget(scan,closest)
{
  var target=false;
  while (scan) 
    if ((scan===sbook_root)||(scan===sbook_root)||(scan.sbookui))
      return target;
    else if (scan.id)
      if (fdjtHasClass(scan,"sbookfoci"))
	return scan;
      else if (fdjtElementMatches(scan,sbook_focus_rules))
	return scan;
      else {
	if (!(target)) target=scan;
	scan=scan.parentNode;}
    else if (scan.sbook_ref) return scan;
    else scan=scan.parentNode;
  return target;
}

/* Simple interaction model */

function sbook_justonclick(evt)
{
  evt=evt||event;
  sbook_trace("sbook_justonclick",evt);
  var target=$T(evt);
  if (fdjtIsClickactive(target)) return;
  var ref=sbookGetRef(target);
  if (sbook_preview)
    if (ref) sbookPreview(ref);
    else if (fdjtHasParent(target,sbook_preview))
      sbookGoTo(sbook_preview);
    else sbookPreview(false);
  else if (ref) sbookPreview(ref);
  else if (sbookInUI(target)) {}
  else if (evt.clientX<sbook_left_px)
    sbookBackward();
  else if ((window.innerWidth-evt.clientX)<sbook_right_px)
    sbookForward();
  else if ((sbook_target)&&(fdjtHasParent(target,sbook_target)))
    sbookOpenGlossmark(sbook_target,true);
  else sbookSetTarget(sbookTouchTarget(target));
}

/* Interaction with click and hold */

var sbook_click_threshold=800;
var sbook_touched=false;
var sbook_touchtime=false;
var sbook_touch_x=false;
var sbook_touch_y=false;

function sbook_touchdown(elt,evt)
{
  if (fdjtIsClickactive(elt)) return;
  var target=sbookTouchTarget(elt);
  if (!(target)) return;
  fdjtTrace("[%f] sbook_touchdown %o @%o old=%o evt=%o",
	    fdjtET(),evt.type,target,sbook_touched,evt);
  if (sbook_touched===target) return;
  sbook_touched=target;
  if (!(sbook_touchtime)) {
    sbook_touchtime=fdjtTime();
    sbook_touch_x=evt.clientX;
    sbook_touch_y=evt.clientY;}
  var ref=sbookGetRef(elt);
  if (ref) {
    if ((sbook_preview)&&(sbook_preview===ref))
      sbookPreview(false);
    else sbookPreview(ref);}
  else if (sbook_preview) {}
  else if ((sbook_target)&&(fdjtHasParent(sbook_target,target)))
    sbookMark(sbook_target);
  else if (sbook_mode)
    fdjtDropClass(sbookHUD,sbookHUDMode_pat);
  else fdjtSwapClass(sbookHUD,sbookHUDMode_pat,"context");
}

function sbook_touchup(elt,evt)
{
  if (fdjtIsClickactive(elt)) return;
  var isclick=
    ((fdjtTime()-sbook_touchtime)<sbook_click_threshold);
  fdjtTrace("[%f] sbook_touchup %o @%o evt=%o isclick=%o",
	    fdjtET(),evt.type,sbook_touched,evt,isclick);
  if (!(sbook_touched)) return;
  var target=sbook_touched;
  var this_target=sbookTouchTarget(evt.target);
  var ref=((sbook_touched)&&(sbookGetRef(sbook_touched)));
  sbook_touched=false;
  sbook_touchtime=false;
  if (sbook_preview)
    if (ref)
      if (isclick) {}
      else sbookPreview(false);
    else if ((isclick)&&(fdjtHasParent(elt,sbook_preview)))
      sbookGoTo(elt);
    else sbookPreview(false);
  else if (isclick)
    if ((sbook_target)&&(sbook_target===this_target))
      if (fdjtHasParent(elt,sbook_target))
	sbookMark(sbook_target);
      else sbookSetTarget(this_target);
    else sbookSetTarget(this_target);
  else if (sbook_mode)
    fdjtSwapClass(sbookHUD,sbookHUDMode_pat,sbook_mode);
  else fdjtDropClass(sbookHUD,"context");
}

var sbook_mouse_focus=false;
var sbook_shift_key=false;
var sbook_mousedown=false;

function sbook_onclick(evt)
{
  evt=evt||event;
  // sbook_trace("sbook_onclick",evt);
  var target=$T(evt);
  if (fdjtIsClickactive(target)) return;
  else fdjtCancelEvent(evt);
}

function sbook_onmousedown(evt)
{
  evt=evt||event;
  // sbook_trace("sbook_onmousedown",evt);
  if (evt.button===0) {
    sbook_mousedown=true;
    sbook_touchdown($T(evt),evt);}
}

function sbook_onmouseup(evt)
{
  evt=evt||event;
  if (evt.button===0) {
    sbook_mousedown=false;
    // sbook_trace("sbook_onmouseup",evt);
    if (!(sbook_shift_key)) {
      sbook_touchup($T(evt),evt);
      fdjtCancelEvent(evt);}}
}

function sbook_onmouseover(evt)
{
  evt=evt||event;
  if ((sbook_preview)&&(!(sbookGetRef($T(evt))))) return;
  sbook_mouse_focus=
    sbookTouchTarget($T(evt))||sbook_mouse_focus;
  if ((sbook_mouse_focus)&&((sbook_shift_key)||(sbook_mousedown)))
    sbook_touchdown(sbook_mouse_focus,evt);
}

function sbook_onmouseout(evt)
{
  evt=evt||event;
  sbook_mouse_focus=false;
}

function sbook_onkeydown(evt)
{
  evt=evt||event||null;
  var kc=evt.keyCode;
  // sbook_trace("sbook_onkeydown",evt);
  if (evt.keyCode===27) { /* Escape works anywhere */
    if (sbook_mode) {
      sbook_last_mode=sbook_mode;
      sbookHUDMode(false);
      fdjtDropClass(document.body,"hudup");
      sbookStopPreview(evt);
      sbookSetTarget(false);
      $("SBOOKSEARCHTEXT").blur();}
    else if (sbook_last_mode) sbookHUDMode(sbook_last_mode);
    else {
      if ((sbook_mark_target)&&(fdjtIsVisible(sbook_mark_target)))
	sbookHUDMode("mark");
      else sbookHUDMode("context");}
    return;}
  else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if (kc===34) sbookForward();   /* page down */
  else if (kc===33) sbookBackward();  /* Page Up */
  else if (fdjtIsTextInput($T(evt))) return true;
  else if (kc===16) { /* Shift key */
    sbook_shift_key=true;
    if (sbook_mouse_focus) sbook_touchdown(sbook_mouse_focus,evt);}
  else if (kc===32) sbookForward(); // Space
  else if ((kc===8)||(kc===45)) sbookBackward(); // backspace or delete
  else if (kc===36)  
    // Home goes to the current head.
    sbookGoTo(sbook_head);
  else return;
}

function sbook_onkeyup(evt)
{
  evt=evt||event||null;
  var kc=evt.keyCode;
  // sbook_trace("sbook_onkeyup",evt);
  if (fdjtIsTextInput($T(evt))) return true;
  else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
  else if (kc===16) {
    sbook_shift_key=false;
    sbook_touchup(sbook_mouse_focus,evt);
    fdjtCancelEvent(evt);}
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
    if ((horizontal===0)&&(vertical===0)) sbookMark($T(evt));
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
  window.onscroll=sbook_onscroll;
  window.onclick=sbook_justonclick;
  // window.onmousedown=sbook_onmousedown;
  // window.onmouseup=sbook_onmouseup;
  // window.onmouseover=sbook_onmouseover;
  // For command keys
  window.onkeypress=sbook_onkeypress;
  window.onkeydown=sbook_onkeydown;
  // window.onkeyup=sbook_onkeyup;
}

function sbookTouchGestureSetup()
{
  // These are for mouse tracking
  window.onscroll=sbook_onscroll;
  window.onclick=sbook_justonclick;
  // These are for gesture recognition and adding glosses
  // document.body.onclick=sbook_onclick;
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

