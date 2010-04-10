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

/* Body click events */

function sbook_body_onclick(evt)
{
  evt=evt||event;
  // sbook_trace("sbook_body_onclick",evt);
  var target=$T(evt);
  if (fdjtIsClickactive(target)) return;
  if (sbook_preview)
    if (fdjtHasParent(target,sbook_preview)) {
      var goto=sbook_preview;
      sbookPreview(false); sbookHUDMode(false);
      sbookGoTo(goto);}
    else sbookPreview(false);
  else if ((sbook_mode)&&(sbook_mode!=="context"))
    sbookHUDMode(false);
  else if (sbook_target)
    if (fdjtHasParent(target,sbook_target))
      sbookMark(sbook_target);
    else sbookSetTarget(sbookGetTarget(target));
  else sbookSetTarget(sbookGetTarget(target));
  fdjtCancelEvent();
}

/* Preview events */

var sbook_preview_mousedown=false;
var sbook_preview_shiftdown=false;
var sbook_preview_target=false;
var sbook_stopping_preview=false;
var sbook_preview_stop_delay=1000;
var sbook_hold_threshold=1000;

function sbookHUD_onmousedown(evt)
{
  var ref=false;
  var target=$T(evt);
  evt=evt||event;
  // sbook_trace("sbookHUD_onmousedown",evt);
  if (fdjtIsClickactive(target)) return;
  else if ((evt.ctrlKey)||(evt.altKey)) return;
  else if ((sbook_preview_shiftdown)||(sbook_preview_mousedown))
    return;
  else if (sbook_preview) {
    var ref=sbookGetRef(target);
    if (ref===sbook_preview) sbookPreview(false);
    else {
      sbook_preview_mousedown=fdjtTime();
      sbookPreview(ref); fdjtCancelEvent(evt);}}
  else if (ref=sbookGetRef(target)) {
    if (sbook_stopping_preview) clearTimeout(sbook_stopping_preview);
    sbook_stopping_preview=false;
    sbook_preview_mousedown=fdjtTime();
    sbookPreview(ref); fdjtCancelEvent(evt);}
  else return;
}

function sbookHUD_onmouseup(evt)
{
  var target=$T(evt);
  evt=evt||event;
  // sbook_trace("sbookHUD_onmouseup",evt);
  if (fdjtIsClickactive(target)) {}
  else if ((evt.ctrlKey)||(evt.altKey)) {}
  else if (sbook_preview_shiftdown) {}
  else if (sbook_preview) {
    // sbook_trace("sbookHUD_onmouseup/sp",evt);    
    var tick=fdjtTime();
    if ((sbook_preview_mousedown)&&
	((tick-sbook_preview_mousedown)>sbook_hold_threshold)) {
      sbook_stopping_preview=
	setTimeout(sbookPreview,sbook_preview_stop_delay,false);}
    sbook_preview_mousedown=false;
    return;}
  else {}
  sbook_preview_mousedown=false;
  fdjtCancelEvent();
}

function sbookHUD_onclick(evt)
{
  var target=$T(evt);
  evt=evt||event;
  // sbook_trace("sbookHUD_onclick",evt);
  if (sbook_preview_mousedown) sbook_preview_mousedown=false;
  if (fdjtIsClickactive(target)) return;
  else fdjtCancelEvent(evt);
}

function sbookHUD_onmouseover(evt)
{
  var ref=sbookGetRef($T(evt));
  // sbook_trace("sbookHUD_onmouseover",evt);
  if (ref)
    if (sbook_preview)
      if (sbook_preview===ref) {}
      else sbookPreview(ref);
    else sbook_preview_target=$T(evt);
}

function sbookHUD_onmouseout(evt)
{
  sbook_preview_target=false;
}

/* Keyboard handlers */

function sbook_onkeydown(evt)
{
  evt=evt||event||null;
  var kc=evt.keyCode;
  // sbook_trace("sbook_onkeydown",evt);
  if (evt.keyCode===27) { /* Escape works anywhere */
    if (sbook_mode) {
      sbook_last_mode=sbook_mode;
      fdjtDropClass(document.body,"hudup");
      sbookHUDMode(false);
      sbookPreview(false);
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
    sbook_preview_shiftdown=fdjtTime();
    if ((!(sbook_preview))&&(sbook_preview_target)) {
      var ref=sbookGetRef(sbook_preview_target);
      if (ref) sbookPreview(ref);}}
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
    if (sbook_preview_mousedown) {
      sbook_preview_shiftdown=false;
      return;}
    var tick=fdjtTime();
    if ((sbook_preview_shiftdown)&&
	((tick-sbook_preview_shiftdown)>sbook_hold_threshold)) {
      sbook_stopping_preview=
	setTimeout(sbookPreview,sbook_preview_stop_delay,false);}
    sbook_preview_shiftdown=false;}
}

/* Keypress handling */

var sbook_modechars={
 43: "mark",13: "mark",
 63: "searching",102: "searching",
 83: "searching",115: "searching",
 70: "searching",
 100: "device",68: "device",
 110: "toc",78: "toc",
 116: "apptoc",84: "apptoc",
 104: "help",72: "help",
 103: "glosses",71: "glosses",
 67: "console", 99: "console",
 76: "layers", 108: "layers"};

function sbook_onkeypress(evt)
{
  var modearg=false;
  evt=evt||event||null;
  // sbook_trace("sbook_onkeypress",evt);
  if (fdjtIsTextInput($T(evt))) return true;
  else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if ((evt.charCode===65)||(evt.charCode===97)) /* A */
    modearg=sbook_last_app||"help";
  else if (((!(sbook_mode))||(sbook_mode==="context"))&&
	    ((evt.charCode===112)||(evt.charCode===80))) /* P */
    if (sbook_pageview) sbookPageView(false);
    else sbookPageView(true);
  else modearg=sbook_modechars[evt.charCode];
  if (modearg) 
    if (sbook_mode===modearg) sbookHUDMode(false);
    else sbookHUDMode(modearg);
  else {}
  if (sbook_mode==="searching")
    $("SBOOKSEARCHTEXT").focus();
  else if (sbook_mode==="mark") {
    sbookMarkHUDSetup(false);
    $("SBOOKMARKINPUT").focus();}
  else $("SBOOKSEARCHTEXT").blur();
  fdjtCancelEvent(evt);
}

/* Top level functions */

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
  document.body.onscroll=sbook_onscroll;
  document.body.onclick=sbook_body_onclick;
  sbookHUD.addEventListener("click",sbookHUD_onclick);
  sbookHUD.addEventListener("mouseover",sbookHUD_onmouseover);
  sbookHUD.addEventListener("mouseout",sbookHUD_onmouseout);
  sbookHUD.addEventListener("mousedown",sbookHUD_onmousedown);
  document.body.addEventListener("mouseup",sbookHUD_onmouseup);
  // For command keys
  window.onkeypress=sbook_onkeypress;
  window.onkeydown=sbook_onkeydown;
  window.onkeyup=sbook_onkeyup;
}

function sbookTouchGestureSetup()
{
  sbookMouseGestureSetup();
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

