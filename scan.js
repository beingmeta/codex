/* -*- Mode: Javascript; -*- */

var sbooks_scan_id="$Id$";
var sbooks_scan_version=parseInt("$Revision$".slice(10,-1));

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

/* Scanning the document for Metadata */

function sbookScan(root,tocinfo,taginfo){
  var result=this;
  if (result.prototype!==sbookScan.prototype) result={};
  if (!(root)) root=document.body;
  if (!(tocinfo)) tocinfo=[];
  if (!(taginfo)) taginfo=[];
  var start=new Date();
  result.root=root; result.tocinfo=tocinfo; result.taginfo=taginfo;
  fdjtLog("[%o] Scanning %o DOM for metadata",start,root);
  var children=root.childNodes, level=false;
  var rootinfo=((sbookScan.nodeFn)?(sbookScan.nodeFn(root)):({}));
  var scanstate=
    {curlevel: 0,idserial:0,location: 0,
     nodecount: 0,eltcount: 0,
     tagstack: [],taggings: [],
     idstate: {prefix: false,count: 0},
     idstack: [{prefix: false,count: 0}]};
  scanstate.curhead=root; scanstate.curinfo=rootinfo;
  if (root.id) tocinfo[root.id]=rootinfo;
  // Location is an indication of distance into the document
  var location=0;
  rootinfo.title=root.title||document.title;
  rootinfo.starts_at=0;
  rootinfo.level=0; rootinfo.sub=new Array();
  rootinfo.head=false; rootinfo.heads=new Array();
  if (!(root.id)) root.id="SBOOKROOT";
  rootinfo.id=root.id;
  /* Build the metadata */
  var i=0; while (i<children.length) {
    var child=children[i++];
    if (!(child.sbookskip))
      sbookScan.scanner(child,scanstate,tocinfo,taginfo,sbookScan.nodeFn);} 
  result.nodecount=scanstate.nodecount;
  result.eltcount=scanstate.eltcount;
  result.maxloc=scanstate.location;
  var scaninfo=scanstate.curinfo;
  /* Close off all of the open spans in the TOC */
  while (scaninfo) {
    scaninfo.ends_at=scanstate.location;
    scaninfo=scaninfo.head;}
  var done=new Date();
  fdjtLog('[%fs] Finished gathering metadata in %f secs over %d/%d heads/nodes',
	  fdjtET(),(done.getTime()-start.getTime())/1000,
	  tocinfo.length,scanstate.eltcount);
  result.root=root;
  return result;}

sbookScan.headTitle=function(head) {
  var title=
    (head.toctitle)||
    head.getAttributeNS('toctitle','http://sbooks.net')||
    head.getAttribute('toctitle')||
    head.getAttribute('data-toctitle')||
    head.title;
  if (!(title)) title=head.innerText;
  if ((!(title))&&(head.innerHTML))
    title=(head.innerHTML).replace();
  if (!(title))
    title=sbookScan.gatherText(head);
  if (typeof title === "string") {
    var std=fdjtStdSpace(title);
    if (std==="") return false;
    else return std;}
  else return fdjtTextify(title,true);
};

sbookScan.gatherText=function(head,s) {
    if (!(s)) s="";
    if (head.nodeType===3)
      return s+head.nodeValue;
    else if (head.nodeType!==1) return s;
    else {
      var children=head.childNodes;
      var i=0; var len=children.length;
      while (i<len) {
	var child=children[i++];
	if (child.nodeType===3) s=s+child.nodeValue;
	else if (child.nodeType===1)
	  s=sbookScan.gatherText(child,s);
	else {}}
      return s;}};

sbookScan.textWidth=function(elt){
  if (elt.nodeType===3) return elt.nodeValue.length;
  else if (elt.nodeType===1) {
    var children=elt.childNodes; var loc=0;
    var i=0; var len=children.length;
    while (i<len) {
      var child=children[i++];
      if (child.nodeType===3) loc=loc+child.nodeValue.length;
      else if (child.nodeType===1)
	loc=loc+sbookScan.TextWidth(child);
      else {}}
    return loc;}
  else return 0;};

sbookScan.headLevel=function(elt){
  if (elt.toclevel) return elt.toclevel;
  var attrval=
    elt.getAttributeNS('toclevel','http://sbooks.net')||
    elt.getAttribute('toclevel')||elt.getAttribute('data-toclevel');
  if (attrval) return parseInt(attrval);
  if (elt.className) {
    var cname=elt.className;
    var tocloc=cname.search(/sbook\dhead/);
    if (tocloc>=0) return parseInt(cname.slice(5,6));}
  if (elt.tagName.search(/H\d/)==0)
    return parseInt(elt.tagName.slice(1,2));
  else return false;};

sbookScan.handleHead=function
  (head,tocinfo,scanstate,level,curhead,curinfo,curlevel,nodefn){
  var headid=head.id;
  var headinfo=tocinfo[headid];
  if (!(headinfo)) {
    if (nodefn)
      headinfo=tocinfo[headid]=nodefn(head);
    else headinfo=tocinfo[headid]={};
    tocinfo.push(headid);}
  if (sbookScan.trace)
    fdjtLog("Scanning head item %o under %o at level %d w/id=#%s ",
	    head,curhead,level,headid);
  /* Iniitalize the headinfo */
  headinfo.starts_at=scanstate.location;
  headinfo.elt=head; headinfo.level=level;
  headinfo.sub=new Array(); headinfo.id=headid;
  headinfo.title=sbookScan.headTitle(head);
  headinfo.next=false; headinfo.prev=false;
  if (level>curlevel) {
    /* This is the simple case where we are a subhead
       of the current head. */
    headinfo.sbook_head=curinfo;
    if (!(curinfo.intro_ends_at))
      curinfo.intro_ends_at=scanstate.location;
    curinfo.sub.push(headinfo);}
  else {
    /* We're not a subhead, so we're popping up at least one level. */
    var scan=curhead;
    var scaninfo=curinfo;
    var scanlevel=curinfo.level;
    /* Climb the stack of headers, closing off entries and setting up
       prev/next pointers where needed. */
    while (scaninfo) {
      if (sbookScan.trace)
	fdjtLog("Finding head: scan=%o, info=%o, sbook_head=%o, cmp=%o",
		scan,scaninfo,scanlevel,scaninfo.sbook_head,
		(scanlevel<level));
      if (scanlevel<level) break;
      if (level===scanlevel) {
	headinfo.prev=scan;
	scaninfo.next=headinfo;}
      scaninfo.ends_at=scanstate.location;
      scanstate.tagstack=scanstate.tagstack.slice(0,-1);
      scaninfo=scaninfo.sbook_head;
      scanlevel=((scaninfo)?(scaninfo.level):(0));}
    if (sbookScan.trace)
      fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
	      scan,scaninfo,scaninfo.level,scaninfo.sbook_head);
    /* We've found the head for this item. */
    headinfo.sbook_head=scaninfo;
    scaninfo.sub.push(headinfo);} /* handled below */
  /* Add yourself to your children's subsections */
  var supinfo=headinfo.sbook_head;
  var newheads=new Array();
  newheads=newheads.concat(supinfo.sbook_heads); newheads.push(supinfo);
  headinfo.sbook_heads=newheads;
  if (sbookScan.trace)
    fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
	    scanstate.location,head,headinfo,headinfo.sbook_head);
  /* Update the toc state */
  scanstate.curhead=head;
  scanstate.curinfo=headinfo;
  scanstate.curlevel=level;
  if (headinfo)
    headinfo.head_ends_at=scanstate.location+fdjtFlatWidth(head);
  scanstate.location=scanstate.location+fdjtFlatWidth(head);
};

sbookScan.scanner=function(child,scanstate,tocinfo,taginfo,nodefn){
  var location=scanstate.location;
  var curhead=scanstate.curhead;
  var curinfo=scanstate.curinfo;
  var curlevel=scanstate.curlevel;
  scanstate.nodecount++;
  // Location tracking and TOC building
  if (child.nodeType===3) {
    var width=child.nodeValue.length;
    // Need to regularize whitespace
    scanstate.location=scanstate.location+width;
    return 0;}
  else if (child.nodeType!==1) return 0;
  else {}
  scanstate.eltcount++;
  if (nodefn) {
    var info=nodefn(child);
    info.sbookloc=location;
    info.sbookhead=curhead.id;}
  else {
    child.sbookloc=location;
    child.sbookhead=curhead.id;}
  if ((child.sbookskip)||
      ((child.className)&&(child.className.search(/\bsbookskip\b/)>=0)))
    return;
  var toclevel=((child.id)&&(sbookScan.headLevel(child)));
  if (child.id) {
    var tags=child.getAttributeNS('tags','http://sbooks.net/')||
      child.getAttribute('tags')||child.getAttribute('data-tags');
    if (tags) {
      taginfo.push(child.id);
      taginfo[child.id]=tags.split(';');}}
  if (toclevel)
    sbookScan.handleHead
      (child,tocinfo,scanstate,toclevel,curhead,curinfo,curlevel,nodefn);
  var children=child.childNodes;
  var i=0; var len=children.length;
  while (i<len) {
    var grandchild=children[i++];
    if (grandchild.nodeType===3)
      scanstate.location=scanstate.location+
	grandchild.nodeValue.length;
    else if (grandchild.nodeType===1) {
      sbookScan.scanner(grandchild,scanstate,tocinfo,taginfo,nodefn);}}
};

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
