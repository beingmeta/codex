/* -*- Mode: Javascript; -*- */

var sbooks_scan_id="$Id$";
var sbooks_scan_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
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

function sbookScan(root,docinfo){
    if (typeof root === 'undefined') return this;
    if (!(docinfo))
	if (this instanceof sbookScan)
	    docinfo=this;
    else docinfo=new sbookScan();
    if (!(root)) root=sbook.root||document.body;
    var start=new Date();
    docinfo._root=root;
    if (!(root.id)) root.id="SBOOKROOT";
    if (sbook.Trace.startup)
	fdjtLog("[%fs] Scanning DOM for structure and metadata: %o",
		fdjtET(),root);
    var nodefn=sbookScan.nodeFn||false;
    var children=root.childNodes, level=false;
    var scanstate=
	{curlevel: 0,idserial:0,location: 0,
	 nodecount: 0,eltcount: 0,headcount: 0,
	 tagstack: [],taggings: [],
	 idstate: {prefix: false,count: 0},
	 idstack: [{prefix: false,count: 0}],
	 pool: sbook.DocInfo};
    var rootinfo=(((nodefn)&&(nodeFn(root)))||(docinfo[root.id])||
		  (docinfo[root.id]=new scanInfo(root.id,scanstate)));
    scanstate.curhead=root; scanstate.curinfo=rootinfo;
    // Location is an indication of distance into the document
    var location=0;
    rootinfo.pool=scanstate.pool;
    rootinfo.title=root.title||document.title;
    rootinfo.starts_at=0;
    rootinfo.level=0; rootinfo.sub=new Array();
    rootinfo.head=false; rootinfo.heads=new Array();
    rootinfo.frag=root.id;
    rootinfo.qid="#"+root.id;
    rootinfo.elt=root;
    /* Build the metadata */
    var i=0; while (i<children.length) {
	var child=children[i++];
	if (!((child.sbookskip)||(child.sbookui)))
	    scanner(child,scanstate,docinfo,sbookScan.nodeFn||false);} 
    docinfo._nodecount=scanstate.nodecount;
    docinfo._eltcount=scanstate.eltcount;
    docinfo._maxloc=scanstate.location;
    var scaninfo=scanstate.curinfo;
    /* Close off all of the open spans in the TOC */
    while (scaninfo) {
	scaninfo.ends_at=scanstate.location;
	scaninfo=scaninfo.head;}
    var done=new Date();
    if (sbook.Trace.startup)
	fdjtLog('[%fs] Gathered metadata in %f secs over %d/%d heads/nodes',
		fdjtET(),(done.getTime()-start.getTime())/1000,
		scanstate.headcount,scanstate.eltcount);
    return docinfo;

    function scanInfo(id,scanstate) {
	if (docinfo[id]) return docinfo[id];
	this.pool=scanstate.pool;
	this.frag=id;
	this.qid="#"+id;
	docinfo[id]=this;
	return this;}
    sbookScan.scanInfo=scanInfo;

    function getTitle(head) {
	var title=
	    (head.toctitle)||
	    ((head.getAttributeNS)&&
	     (head.getAttributeNS('toctitle','http://sbooks.net')))||
	    (head.getAttribute('toctitle'))||
	    (head.getAttribute('data-toctitle'))||
	    (head.title);
	if (!(title)) title=gatherText(head);
	if (typeof title === "string") {
	    var std=fdjtString.stdspace(title);
	    if (std==="") return false;
	    else return std;}
	else return fdjtDOM.textify(title,true);}

    function gatherText(head,s) {
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
		    s=gatherText(child,s);
		else {}}
	    return s;}}

    function textWidth(elt){
	if (elt.nodeType===3) return elt.nodeValue.length;
	else if (elt.nodeType===1) {
	    var children=elt.childNodes; var loc=0;
	    var i=0; var len=children.length;
	    while (i<len) {
		var child=children[i++];
		if (child.nodeType===3) loc=loc+child.nodeValue.length;
		else if (child.nodeType===1)
		    loc=loc+textWidth(child);
		else {}}
	    return loc;}
	else return 0;}

    function getLevel(elt){
	if (elt.toclevel) {
	    if (elt.toclevel==='none')
		return elt.toclevel=false;
	    else return elt.toclevel;}
	var attrval=
	    ((elt.getAttributeNS)&&
	     (elt.getAttributeNS('toclevel','http://sbooks.net')))||
	    (elt.getAttribute('toclevel'))||
	    (elt.getAttribute('data-toclevel'));
	if (attrval) {
	    if (attrval==='none') return false;
	    else return parseInt(attrval);}
	if (elt.className) {
	    var cname=elt.className;
	    var tocloc=cname.search(/sbook\dhead/);
	    if (tocloc>=0) return parseInt(cname.slice(5,6));}
	if (elt.tagName.search(/H\d/)==0)
	    return parseInt(elt.tagName.slice(1,2));
	else return false;}
    sbook.getTOCLevel=getLevel;
    
    function handleHead
    (head,docinfo,scanstate,level,curhead,curinfo,curlevel,nodefn){
	var headid=head.id;
	var headinfo=((nodefn)&&(nodefn(head)))||docinfo[headid]||
	    (docinfo[headid]=new scanInfo(headid,scanstate));
	scanstate.headcount++;
	if ((headinfo.elt)&&(headinfo.elt!==head)) {
	    var newid=headid+"x"+scanstate.location;
	    fdjtLog.warn("[%fs] Duplicate ID=%o newid=%o",fdjtET(),headid,newid);
	    head.id=headid=newid;
	    headinfo=((nodefn)&&(nodefn(head)))||docinfo[headid]||
		(docinfo[headid]=new scanInfo(headid,scanstate));}
	if (sbook.Trace.scan)
	    fdjtLog("Scanning head item %o under %o at level %d w/id=#%s ",
		    head,curhead,level,headid);
	/* Iniitalize the headinfo */
	headinfo.starts_at=scanstate.location;
	headinfo.elt=head; headinfo.level=level;
	headinfo.sub=new Array();
	headinfo.frag=headid; headinfo.qid="#"+headid;
	headinfo.title=getTitle(head);
	headinfo.next=false; headinfo.prev=false;
	if (level>curlevel) {
	    /* This is the simple case where we are a subhead
	       of the current head. */
	    headinfo.head=curinfo;
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
		if (sbook.Trace.scan)
		    fdjtLog("Finding head: scan=%o, info=%o, sbook_head=%o, cmp=%o",
			    scan,scaninfo,scanlevel,scaninfo.head,
			    (scanlevel<level));
		if (scanlevel<level) break;
		if (level===scanlevel) {
		    headinfo.prev=scaninfo;
		    scaninfo.next=headinfo;}
		scaninfo.ends_at=scanstate.location;
		scanstate.tagstack=scanstate.tagstack.slice(0,-1);
		scaninfo=scaninfo.head; scan=scaninfo.elt;
		scanlevel=((scaninfo)?(scaninfo.level):(0));}
	    if (sbook.Trace.scan)
		fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
			scan,scaninfo,scaninfo.level,scaninfo.head);
	    /* We've found the head for this item. */
	    headinfo.head=scaninfo;
	    scaninfo.sub.push(headinfo);} /* handled below */
	/* Add yourself to your children's subsections */
	var supinfo=headinfo.head;
	var newheads=new Array();
	if (supinfo.heads)
	    newheads=newheads.concat(supinfo.heads);
	if (supinfo) newheads.push(supinfo);
	headinfo.heads=newheads;
	if (sbook.Trace.scan)
	    fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
		    scanstate.location,head,headinfo,headinfo.head);
	/* Update the toc state */
	scanstate.curhead=head;
	scanstate.curinfo=headinfo;
	scanstate.curlevel=level;
	if (headinfo)
	    headinfo.ends_at=scanstate.location+fdjtDOM.textWidth(head);
	scanstate.location=scanstate.location+fdjtDOM.textWidth(head);}

    function scanner(child,scanstate,docinfo,nodefn){
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
	var toclevel=((child.id)&&(getLevel(child)));
	scanstate.eltcount++;
	var info=((nodefn)&&(nodefn(child)));
	if ((!(info))&&(child.id)&&(!(info=docinfo[child.id]))) {
	    var id=child.id;
	    info=new scanInfo(id,scanstate);}
	if ((info)&&(info.elt)&&(child.id)&&(info.elt!==child)) {
	    var newid=child.id+"x"+scanstate.location;
	    fdjtLog.warn("[%fs] Duplicate ID=%o newid=%o",fdjtET(),child.id,newid);
	    child.id=id=newid;
	    info=((nodefn)&&(nodefn(head)))||docinfo[id]||
		(docinfo[id]=new scanInfo(id,scanstate));}
	if (info) {
	    info.starts_at=scanstate.location;
	    info.sbookhead=curhead.id;
	    info.headstart=curinfo.starts_at;}
	if (info) info.head=curinfo;
	if ((child.sbookskip)||(child.sbookui)||
	    ((child.className)&&(child.className.search(/\bsbookskip\b/)>=0)))
	    return;
	if ((info)&&(toclevel)&&(!(info.toclevel))) info.toclevel=toclevel;
	if (child.id) {
	    var tags=
		((child.getAttributeNS)&&
		 (child.getAttributeNS('tags','http://sbooks.net/')))||
		(child.getAttribute('tags'))||
		(child.getAttribute('data-tags'));
	    if (tags) info.tags=tags.split(';');}
	if (toclevel)
	    handleHead(child,docinfo,scanstate,toclevel,curhead,curinfo,curlevel,nodefn);
	var children=child.childNodes;
	var i=0; var len=children.length;
	while (i<len) {
	    var grandchild=children[i++];
	    if (grandchild.nodeType===3)
		scanstate.location=scanstate.location+
		grandchild.nodeValue.length;
	    else if (grandchild.nodeType===1) {
		scanner(grandchild,scanstate,docinfo,nodefn);}}
	if (info) info.ends_at=scanstate.location;}}

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
