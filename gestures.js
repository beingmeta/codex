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

// Whether to do gesture recognition
var sbook_gestures=true;
var sbook_trace_gestures=false;

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
  if ((evt.button>1)||(evt.ctrlKey)) return;
  sbook_mousedown_x=evt.screenX;
  sbook_mousedown_y=evt.screenY;
  sbook_mousedown_tick=fdjtTick();
  var target=$T(evt);
  // Ignore clicks on text fields, anchors, inputs, etc
  if (fdjtHasParent(target,sbookHUD)) return;
  else if ((sbook_mode)&&(sbook_mode!=="minimal")) {
    sbookHUDMode(false);
    return;}
  else if (fdjtIsClickactive(target)) return;
  else {}
  var focus=sbookGetFocus(target);
  if (!(focus)) return;
  if (sbook_target)
    if (sbook_target===focus)
      sbook_mark(focus,false,fdjtSelectedText());
    else {
      sbookSetTarget(false);
      sbookHUDMode(false);}
  else {
    sbookSetTarget(focus);
    sbookHUDMode("minimal");}
}

function sbook_onmouseup(evt)
{
  evt=evt||event||null;
  var target=$T(evt);
  var focus=sbookGetFocus(target);
  // sbook_trace("sbook_onmouseup",evt);
  if ((evt.button>1)||(!(focus))||fdjtIsClickactive(target)) {
    sbook_mousedown_x=false;
    sbook_mousedown_y=false;
    sbook_mousedown_tick=false;
    return;}
  else target=sbookGetFocus(target);
  if ((sbook_gestures)&&(sbook_mousedown_tick))
    sbookHandleGestures(evt);
  else {
    var text=fdjtSelectedText();
    if ((text)&&(text.length>sbook_min_excerpt)) {
      if (sbook_target) sbookSetMarkExcerpt(text);
      else sbook_mark($T(evt),text);}
    else if (sbook_gesture) sbook_mark($T(evt));
    else return;
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue=false;}
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
      if (horizontal>0) sbookNextPage();
      else if (horizontal<0) sbookPrevPage();
      else {}
    else if (absdx<(3*sbook_gq))
      if (vertical>0) sbookNextSection();
      else if (vertical<0) sbookPrevSection();
      else {}
    else {}
    evt.cancelBubble=true;
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue=false;}
}

function sbook_onclick(evt)
{
  evt=evt||event||null;
  // sbook_trace("sbook_onclick",evt);
  var target=$T(evt); var scan=target;
  if (evt.button>1) return;
  // Don't override anchors, input, etc
  if (fdjtIsClickactive(target)) return;
  // If you're clicking on the selected target, mark it
  // Note that this isn't normally the path to marking, since
  // we catch the on mousedown to avoid resetting the selection
  var focus=sbookGetFocus(target);
  if (sbook_target===focus) sbook_mark(target);
  else if (sbook_mode) {
    // This just toggles the HUD off
    sbookHUDMode(false);
    if (evt.preventDefault) evt.preventDefault();
    else evt.returnValue=false;
    return;}
  else if ((!(focus))||(!(focus.id))) return;
  else {
    sbookSetTarget(focus);
    sbookHUDMode("minimal");}
  if (evt.preventDefault) evt.preventDefault();
  else evt.returnValue=false;
  evt.cancelBubble=true;
}

function sbook_ondblclick(evt)
{
  evt=evt||event||null;
  sbook_onclick(evt);
  return;
}

function sbookTabletMode(flag)
{
  if (flag) {
    sbook_gestures=true;
    fdjtAddClass(document.body,"tablet");}
  else {
    sbook_gestures=false;
    fdjtDropClass(document.body,"tablet");}
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

