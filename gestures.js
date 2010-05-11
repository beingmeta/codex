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

var sbook_mousedown=false;
var sbook_hold_threshold=900;

/* click events */

function sbook_body_onclick(evt)
{
  evt=evt||event;
  // sbook_trace("sbook_body_onclick",evt);
  var target=fdjtDOM.T(evt);
  if (fdjtDOM.isClickable(target)) return;
  else if (sbookInUI(target)) return;
  else if (sbook_preview) {
    sbookPreview(false); sbookHUDMode(false);
    sbookGoTo(target);}
  else if ((sbook_mode)&&(sbook_mode!=="context"))
    sbookHUDMode(false);
  else if (sbook_target)
    if ((target===sbook_target)||
	(fdjtDOM.hasParent(target,sbook_target)))
      sbookMark(sbook_target);
    else sbookSetTarget(sbookGetTarget(target));
  else sbookSetTarget(sbookGetTarget(target));
  if (sbook_notfixed) sbookSyncHUD();
  fdjtDOM.cancel(evt);
}

function sbook_onmouseup(evt)
{
  var target=fdjtDOM.T(evt);
  if (sbook_preview) sbookPreview(false);
  sbook_mousedown=false;
}

function sbook_ignoreclick(evt)
{
  var target=fdjtDOM.T(evt);
  if (fdjtDOM.isClickable(target)) return;
  else fdjtDOM.cancel(evt);
}

/* Touch handlers */

function sbook_ontouchstart(evt)
{
  var target=fdjtDOM.T(evt);
  var ref=sbookGetRef(target);
  if (ref) {
    if (sbook_preview)
      if (ref===sbook_preview) sbookPreview(false);
      else sbookPreview(ref);
    else  sbookSetPreview(ref);
    fdjtDOM.cancel(evt);}
}

function sbook_ontouchmove(evt)
{
  var target=fdjtDOM.T(evt);
  var ref=sbookGetRef(target);
  if (ref) {
    if (sbook_preview)
      if (ref===sbook_preview) {}
      else sbookPreview(ref);
    fdjtDOM.cancel(evt);}
}

function sbook_ontouchend(evt)
{
  var target=fdjtDOM.T(evt);
  var ref=sbookGetRef(target);
  if (sbook_preview) sbookStopPreview();
  fdjtDOM.cancel(evt);
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
      fdjtDOM.dropClass(document.body,"hudup");
      sbookHUDMode(false);
      sbookPreview(false);
      sbookSetTarget(false);
      fdjtID("SBOOKSEARCHTEXT").blur();}
    else if (sbook_last_mode) sbookHUDMode(sbook_last_mode);
    else {
      if ((sbook_mark_target)&&(fdjtDOM.isVisible(sbook_mark_target)))
	sbookHUDMode("mark");
      else sbookHUDMode("context");}
    return;}
  else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if (kc===34) sbookForward();   /* page down */
  else if (kc===33) sbookBackward();  /* Page Up */
  else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
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
  if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
  else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
  else {}
}

/* Keypress handling */

var sbook_modechars={
 43: "mark",13: "mark",
 63: "searching",102: "searching",
 83: "searching",115: "searching",
 70: "searching",
 100: "device",68: "device",
 110: "toc",78: "toc",
 116: "dashtoc",84: "dashtoc",
 104: "help",72: "help",
 103: "glosses",71: "glosses",
 67: "console", 99: "console",
 76: "layers", 108: "layers"};

function sbook_onkeypress(evt)
{
  var modearg=false;
  evt=evt||event||null;
  var ch=evt.charCode||evt.keyCode;
  // sbook_trace("sbook_onkeypress",evt);
  if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
  else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
  else if ((ch===65)||(ch===97)) /* A */
    modearg=sbook_last_dash||"help";
  else if (((!(sbook_mode))||(sbook_mode==="context"))&&
	   ((ch===112)||(ch===80))) /* P */
    if (sbook_pageview) sbookPageView(false);
    else sbookPageView(true);
  else modearg=sbook_modechars[ch];
  if (modearg) 
    if (sbook_mode===modearg) sbookHUDMode(false);
    else sbookHUDMode(modearg);
  else {}
  if (sbook_mode==="searching")
    fdjtID("SBOOKSEARCHTEXT").focus();
  else if (sbook_mode==="mark") {
    sbookMarkHUDSetup(false);
    fdjtID("SBOOKMARKINPUT").focus();}
  else fdjtID("SBOOKSEARCHTEXT").blur();
  fdjtDOM.cancel(evt);
}

/* Top level functions */

function sbookInterfaceMode(mode)
{
  if (mode==='touch') {
    sbook_interaction=mode;
    fdjtUI.CheckSpan.set(fdjtID("SBOOKTOUCHMODE"),true,true);
    fdjtDOM.addClass(document.body,"touch");
    sbookCheckPagination();}
  else if (mode==='mouse') {
    sbook_interaction=mode;
    fdjtUI.CheckSpan.set(fdjtID("SBOOKMOUSEMODE"),true,true);
    fdjtDOM.dropClass(document.body,"touch");
    sbookCheckPagination();}
  else if (mode==='keyboard') {
    sbook_interaction=mode;
    fdjtUI.CheckSpan.set(fdjtID("SBOOKKBDMODE"),true,true);
    fdjtDOM.dropClass(document.body,"touch");
    sbookCheckPagination();}
  else {
    sbook_interaction=false;
    fdjtDOM.dropClass(document.body,"touch");}
}

function sbookSparseMode(flag)
{
  if (flag) {
    sbook_sparse=true;
    fdjtUI.CheckSpan.set(fdjtID("SBOOKSPARSE"),true,true);
    fdjtDOM.addClass(document.body,"sparsebook");}
  else {
    sbook_sparse=false;
    fdjtUI.CheckSpan.set(fdjtID("SBOOKSPARSE"),false,true);
    fdjtDOM.dropClass(document.body,"sparsebook");}
}

function sbookFlashMode(flag)
{
  if (flag) {
    fdjtUI.CheckSpan.set(fdjtID("SBOOKHUDFLASH"),true,true);
    sbook_hud_flash=sbook_default_hud_flash;}
  else {
    fdjtUI.CheckSpan.set(fdjtID("SBOOKHUDFLASH"),false,true);
    sbook_hud_flash=false;}
}

/* Setup */

function sbookGestureSetup()
{
  if ((sbook_interaction==='touch')) sbookTouchGestureSetup();
  else sbookMouseGestureSetup();
}

function sbookMouseGestureSetup()
{
  fdjtDOM.addListener(window,"scroll",sbook_onscroll);
  fdjtDOM.addListener(window,"mouseup",sbook_onmouseup);

  fdjtDOM.addListener(document.body,"click",sbook_body_onclick);

 // For command keys
  fdjtDOM.addListener(window,"keypress",sbook_onkeypress);
  fdjtDOM.addListener(window,"keydown",sbook_onkeydown);
  fdjtDOM.addListener(window,"keyup",sbook_onkeyup);
}

function sbookTouchGestureSetup()
{
  fdjtDOM.addListener(document.body,"scroll",sbook_onscroll);
  fdjtDOM.addListener(document.body,"click",sbook_body_onclick);
  var i=0; var len=sbook_nodes.length;
  while (i<len) {
    var node=sbook_nodes[i++];
    if (!(node.onclick)) node.onclick=sbook_body_onclick;}
  fdjtDOM.addListener(sbookHUD,"touchstart",sbook_ontouchstart);
  fdjtDOM.addListener(sbookHUD,"touchmove",sbook_ontouchmove);
  document.fdjtDOM.addListener(body,"touchend",sbook_ontouchend);
  fdjtDOM.addListener(window,"keypress",sbook_onkeypress);
  fdjtDOM.addListener(window,"keydown",sbook_onkeydown);
  fdjtDOM.addListener(window,"keyup",sbook_onkeyup);
  fdjtDOM.addClass(document.body,"touch");
}

function sbookSimpleGestureSetup()
{
  fdjtDOM.addListener(document.body,"scroll",sbook_onscroll);
  fdjtDOM.addListener(document.body,"click",sbook_body_onclick);
  var i=0; var len=sbook_nodes.length;
  while (i<len) {
    var node=sbook_nodes[i++];
    if (!(node.onclick)) node.onclick=sbook_body_onclick;}
  fdjtDOM.addListener(sbookHUD,"mouseover",fdjtUI.CoHi.onmouseover);
  fdjtDOM.addListener(sbookHUD,"mouseout",fdjtUI.CoHi.onmouseout);
  fdjtDOM.addListener(sbookHUD,"click",sbookRef_onclick);
  fdjtDOM.addListener(window,"keypress",sbook_onkeypress);
  fdjtDOM.addListener(window,"keydown",sbook_onkeydown);
  fdjtDOM.addListener(window,"keyup",sbook_onkeyup);
}

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/

