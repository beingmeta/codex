/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/domscan.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file implements extraction of map and metadata from the loaded
   DOM.

   This file is part of metaBook, a Javascript/DHTML web application for reading
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
/* jshint browser: true */
/* global metaBook: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
//var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
//var metaBook=((typeof metaBook !== "undefined")?(metaBook):({}));
//var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
//var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

metaBook.DOMScan=(function(){
    "use strict";

    var fdjtString=fdjt.String;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var RefDB=fdjt.RefDB;
    var Ref=RefDB.Ref;

    var mB=metaBook;

    var getLevel=mB.getTOCLevel;

    function DOMScan(root,dbid,docinfo){
        var md5ID=fdjt.WSN.md5ID;
        var stdspace=fdjtString.stdspace;
        var getStyle=fdjtDOM.getStyle;
        var rootns=root.namespaceURI;
        
        var idmap={};
        
        if (typeof root === 'undefined') return this;
        if (!(docinfo)) {
            if (this instanceof DOMScan) docinfo=this;
            else docinfo=new DOMScan();}
        if (!(root)) root=mB.docroot||document.body;
        var start=new Date();
        var allheads=[], allids=[];
        docinfo._root=root;
        docinfo._heads=allheads;
        docinfo._ids=allids;
        if (!(root.id)) root.id="SBOOKROOT";
        if ((mB.Trace.startup>1)||(mB.Trace.domscan)) {
            if (root.id) 
                fdjtLog("Scanning %s#%s for structure and metadata",
                        root.tagName,root.id);
            else fdjtLog("Scanning DOM for structure and metadata: %o",root);}
        var children=root.childNodes;
        var scanstate=
            {curlevel: 0,idserial:0,location: 0,
             nodecount: 0,eltcount: 0,headcount: 0,
             tagstack: [],taggings: [],allinfo: [],locinfo: [], idmap: idmap,
             idstate: {prefix: false,count: 0},
             idstack: [{prefix: false,count: 0}],
             pool: mB.docdb};

        var docdb=new RefDB(dbid);
        
        function ScanInfo(id,scanstate) {
            if (docinfo[id]) return docinfo[id];
            Ref.call(this,id,docdb);
            var now=fdjtTime();
            this._live=this._changed=now;
            docdb.changes.push(this);
            docdb.changed=now;
            this.frag=id;
            docinfo[id]=this;
            scanstate.allinfo.push(this);
            scanstate.locinfo.push(scanstate.location);
            return this;}
        ScanInfo.prototype=new Ref();
        
        docdb.refclass=ScanInfo;
        docinfo._docdb=docdb;

        function getTitle(head) {
            var title=
                (head.toctitle)||
                ((head.getAttributeNS)&&
                 (head.getAttributeNS('toctitle','http://sbooks.net')))||
                (head.getAttribute('toctitle'))||
                (head.getAttribute('data-toctitle'))||
                (head.title);
            if (!(title)) {
                var head1=fdjtDOM.getFirstChild(head,"H1,H2,H3,H4,H5,H6");
                if (head1) title=head1.toctitle||
                    ((head1.getAttributeNS)&&
                     (head1.getAttributeNS('toctitle','http://sbooks.net')))||
                    (head1.getAttribute('toctitle'))||
                    (head1.getAttribute('data-toctitle'))||
                    (head1.title);
                if ((!(title))&&(head1)) title=gatherText(head1);
                else title=gatherText(head);}
            if (typeof title === "string") {
                var std=stdspace(title);
                if (std==="") return false;
                else return std;}
            else {
                title=fdjtDOM.textify(title,true);
                return title;}}

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
            else if (elt.nodeType!==1) return 0;
            else if (elt.getAttribute("data-loclen"))
                return parseInt(elt.getAttribute("data-loclen"),10);
            else {
                var children=elt.childNodes; var width=0;
                var i=0; var len=children.length;
                while (i<len) {
                    var child=children[i++];
                    if (child.nodeType===3)
                        width=width+child.nodeValue.length;
                    else if (child.nodeType===1)
                        width=width+textWidth(child);
                    else {}}
                return width;}}

        function handleHead(head,headid,docinfo,scanstate,level,
                            curhead,curinfo,curlevel){
            var headinfo=docinfo[headid]||
                (docinfo[headid]=new ScanInfo(headid,scanstate));
            scanstate.headcount++;
            allheads.push(headid);
            if (mB.Trace.domscan>1)
                fdjtLog("Scanning head item %o under %o at level %d w/id=#%s ",
                        head,curhead,level,headid);
            /* Iniitalize the headinfo */
            headinfo.starts_at=scanstate.location;
            headinfo.level=level; headinfo.elt=head; 
            headinfo.sub=[];
            headinfo.frag=headid;
            headinfo.title=getTitle(head);
            headinfo.next=false; headinfo.prev=false;
            if (headinfo.title)
                headinfo.sectag="\u00a7"+stdspace(headinfo.title);
            else headinfo.sectag="\u00a7Anonymous Section";
            if (level>curlevel) {
                /* This is the simple case where we are a subhead
                   of the current head. */
                headinfo.head=curinfo;
                headinfo.indexRef('head',curinfo);
                if (!(curinfo.intro_ends_at))
                    curinfo.intro_ends_at=scanstate.location;
                curinfo.sub.push(headinfo);
                /* There is one special case here, were there is a
                   previous head/section (created by a whole block
                   wrapped in a section/article/etc block. */
                if (scanstate.lastlevel===level) {
                    headinfo.prev=scanstate.lastinfo;
                    scanstate.lastinfo.next=headinfo;
                    delete scanstate.lastlevel;
                    delete scanstate.lasthead;
                    delete scanstate.lastinfo;}}
            else { /* We're not a subhead, so
                      we're popping up at least one level. */
                var scan=curhead;
                var scaninfo=curinfo;
                var scanlevel=curinfo.level;
                /* Climb the stack of headers, closing off entries and setting up
                   prev/next pointers where needed. */
                while (scaninfo) {
                    if (mB.Trace.domscan>2)
                        fdjtLog("Finding head@%d: scan=%o, info=%j, sbook_head=%o, cmp=%o",
                                scanlevel,scan||false,scaninfo,(scanlevel<level));
                    if (scanlevel<level) break;
                    if (level===scanlevel) {
                        headinfo.prev=scaninfo;
                        scaninfo.next=headinfo;}
                    scaninfo.ends_at=scanstate.location;
                    scanstate.tagstack=scanstate.tagstack.slice(0,-1);
                    scaninfo=scaninfo.head;
                    scan=scaninfo.elt||document.getElementById(scaninfo.frag);
                    scanlevel=((scaninfo)?(scaninfo.level):(0));}
                if (mB.Trace.domscan>2)
                    fdjtLog("Found parent: up=%o, upinfo=%o, atlevel=%d, sbook_head=%o",
                            scan||false,scaninfo,scaninfo.level,scaninfo.head);
                /* We've found the enclosing head for this head, so we
                   establish the links. */
                headinfo.head=scaninfo;
                headinfo.indexRef('head',scaninfo);
                scaninfo.sub.push(headinfo);}
            /* If we have a head, we get its tags. */
            var supinfo=headinfo.head;
            
            /* We create an array of all the heads, which lets us
               replace many recursions with iterations. */
            var newheads=[];
            if (supinfo.heads) newheads=newheads.concat(supinfo.heads);
            if (supinfo) newheads.push(supinfo);
            headinfo.heads=newheads;
            headinfo.indexRef('heads',newheads);
            if (mB.Trace.domscan>2)
                fdjtLog("@%d: Found head=%o, headinfo=%o, sbook_head=%o",
                        scanstate.location,head,headinfo,headinfo.head);
            /* Update the toc state */
            scanstate.curhead=head;
            scanstate.curinfo=headinfo;
            scanstate.curlevel=level;
            if (headinfo)
                headinfo.ends_at=scanstate.location+textWidth(head);
            scanstate.location=scanstate.location+textWidth(head);}

        function scanner(child,scanstate,docinfo){
            var location=scanstate.location;
            var curhead=scanstate.curhead;
            var curinfo=scanstate.curinfo;
            var curlevel=scanstate.curlevel;
            scanstate.nodecount++;
            // Location tracking and TOC building
            if (child.nodeType===3) {
                var stdcontent=stdspace(child.nodeValue);
                var width=stdcontent.length;
                // Need to regularize whitespace
                scanstate.location=scanstate.location+width;
                return 0;}
            else if (child.nodeType!==1) return 0;
            else {}
            var tag=child.tagName, classname=child.className;
            var id=child.id;
            if (id) id=child.getAttribute('data-tocid')||id;
            if ((mB.ignore)&&(mB.ignore.match(child))) return;
            if ((rootns)&&(child.namespaceURI!==rootns)) return;
            if ((classname)&&
                ((typeof classname !== "string")||
                 (classname.search(/\b(sbookignore|codexignore)\b/)>=0)))
                return;
            if ((child.codexui)||((id)&&(id.search("CODEX")===0))) return;

            if (mB.Trace.domscan>3)
                fdjtLog("Scanning %o level=%o, loc=%o, head=%o: %j",
                        child,curlevel,location,curhead,curinfo);

            if ((!(id))&&(!(mB.baseid))) {
                // If there isn't a known BASEID, we generate
                //  ids for block level elements using WSN.
                var wsn=false;
                if (((tag.search(/p|h\d|blockquote|li/i)===0)||
                     (getStyle(child).display.search(
                             /block|list-item|table|table-row/)===0))&&
                    ((child.childNodes)&&(child.childNodes.length))&&
                    (wsn=md5ID(child))) {
                    var baseid="WSN_"+wsn, wsnid=baseid, count=1;
                    if (baseid!=="WSN_") {
                        while ((document.getElementById[wsnid])||(idmap[wsnid]))
                            wsnid=baseid+"_"+(count++);
                        if (baseid!==wsnid) {
                            var text=fdjtDOM.textify(child);
                            fdjtLog.warn("Duplicate WSN ID %s: %s",
                                         wsnid,text);}
                        id=child.id=wsnid; idmap[wsnid]=child;}}}
            else if (!(id)) {}
            else if (!(idmap[id])) idmap[id]=child;
            else if (idmap[id]!==child) {
                var newid=id+"x"+scanstate.location;
                if (idmap[id]) {
                    var u=1; var xid=newid+"x"+u;
                    while (idmap[xid]) {u++; xid=newid+"x"+u;}
                    newid=xid;}
                fdjtLog.warn("Duplicate ID=%o newid=%o",id,newid);
                id=child.id=newid;
                headinfo=docinfo[newid]||
                    (docinfo[newid]=new ScanInfo(newid,scanstate));
                idmap[newid]=child;}
            else idmap[id]=child;

            var i=0, lim;
            // Get the location in the TOC for this out of context node
            //  These get generated, for example, when the content of an
            //  authorial footnote is moved elsewhere in the document.
            var tocloc=(child.codextocloc)||
                (child.getAttribute("data-tocloc"));
            if ((tocloc)&&(docinfo[tocloc])) {
                var tocinfo=docinfo[tocloc];
                curlevel=scanstate.curlevel;
                curhead=scanstate.curhead;
                curinfo=scanstate.curinfo;
                var notoc=scanstate.notoc;
                var headinfo=tocinfo.head;
                scanstate.curinfo=headinfo;
                scanstate.curhead=headinfo.elt||document.getElementById(headinfo.frag);
                scanstate.curlevel=headinfo.level;
                scanstate.notoc=true;
                var toc_children=child.childNodes;
                i=0; lim=toc_children.length; while (i<lim) {
                    var toc_child=toc_children[i++];
                    if (toc_child.nodeType===1)
                        scanner(toc_child,scanstate,docinfo);}
                // Put everything back
                scanstate.curlevel=curlevel; scanstate.notoc=notoc;
                scanstate.curhead=curhead; scanstate.curinfo=curinfo;
                return;}
            var toclevel=((id)&&(getLevel(child,curlevel)));
            // The header functionality is handled by its surrounding
            // section (which should have a toclevel of its own)
            if ((scanstate.notoc)||(tag==='header')) {
                scanstate.notoc=true; toclevel=0;}
            scanstate.eltcount++;
            var info=(id&&(docinfo[id]));
            if ((!(info))&&(id)) {
                allids.push(id); info=new ScanInfo(id,scanstate);
                docinfo[id]=info; info.elt=child;}
            if ((info)&&(id)&&(child.id)&&(child.id!==id))
                // Store info under both ID and TOCID if different
                docinfo[child.id]=info;
            if (info) {
                info.starts_at=scanstate.location;
                info.sbookhead=curhead.getAttribute('data-tocid')||curhead.id;
                info.headstart=curinfo.starts_at;}
            // Set the first content node
            if ((id)&&(info)&&(!start)) mB.start=start=child;
            // And the initial content level
            if ((info)&&(toclevel)&&(!(info.toclevel))) info.toclevel=toclevel;
            if ((id)&&(info)) {
                var tags=
                    ((child.getAttributeNS)&&
                     (child.getAttributeNS('tags','http://sbooks.net/')))||
                    (child.getAttribute('tags'))||
                    (child.getAttribute('data-tags'));
                if (tags) info.atags=tags.split(',');}
            if (((classname)&&(classname.search(/\bsbookignore\b/)>=0))||
                ((mB.ignore)&&(mB.ignore.match(child))))
                return;
            if ((toclevel)&&(!(info.tocdone)))
                handleHead(child,id,docinfo,scanstate,toclevel,
                           curhead,curinfo,curlevel);
            else if (info) {
                info.head=curinfo; info.indexRef('head',curinfo);}
            else {}

            if (((classname)&&(classname.search(/\bsbookterminal\b/)>=0))||
                ((classname)&&(mB.terminals)&&
                 (mB.terminals.match(child)))) {
                scanstate.location=scanstate.location+textWidth(child);}
            else {
                var grandchildren=child.childNodes;
                i=0; lim=grandchildren.length;
                while (i<lim) {
                    var grandchild=grandchildren[i++];
                    if (grandchild.nodeType===3) {
                        var content=stdspace(grandchild.nodeValue);
                        scanstate.location=scanstate.location+
                            content.length;}
                    else if (grandchild.nodeType===1) {
                        scanner(grandchild,scanstate,docinfo);}}}
            if (info) info.ends_at=scanstate.location;
            /*
              if ((info)&&((info.ends_at-info.starts_at)<5000))
              info.wsnid=md5ID(child);
            */
            if (toclevel) {
                scanstate.lasthead=child; scanstate.lastinfo=info;
                scanstate.lastlevel=toclevel;}}

        var rootinfo=(docinfo[root.id])||
            (docinfo[root.id]=new ScanInfo(root.id,scanstate));
        scanstate.curhead=root; scanstate.curinfo=rootinfo;
        rootinfo.title=root.title||document.title;
        rootinfo.starts_at=0;
        rootinfo.level=0; rootinfo.sub=[];
        rootinfo.head=false; rootinfo.heads=[];
        rootinfo.frag=root.id;
        rootinfo.elt=root;
        scanstate.allinfo.push(rootinfo);
        scanstate.allinfo.push(0);
        /* Build the metadata */
        var i=0; while (i<children.length) {
            var child=children[i++];
            if (!((child.sbookskip)||(child.codexui)))
                scanner(child,scanstate,docinfo);} 
        docinfo._nodecount=scanstate.nodecount;
        docinfo._headcount=scanstate.headcount;
        docinfo._eltcount=scanstate.eltcount;
        docinfo._maxloc=scanstate.location;
        docinfo._allinfo=scanstate.allinfo;
        docinfo._locinfo=scanstate.locinfo;
        var scaninfo=scanstate.curinfo;
        /* Close off all of the open spans in the TOC */
        while (scaninfo) {
            scaninfo.ends_at=scanstate.location;
            scaninfo=scaninfo.head;}
        var done=new Date();
        if ((mB.Trace.startup)||(mB.Trace.domscan))
            fdjtLog('Gathered metadata in %f secs over %d heads, %d nodes',
                    (done.getTime()-start.getTime())/1000,
                    scanstate.headcount,scanstate.eltcount);
        docinfo.addContent=function(node){
            scanner(node,scanstate,docinfo);
            docinfo._nodecount=scanstate.nodecount;
            docinfo._headcount=scanstate.headcount;
            docinfo._eltcount=scanstate.eltcount;
            docinfo._maxloc=scanstate.location;
            docinfo._allinfo=scanstate.allinfo;
            docinfo._locinfo=scanstate.locinfo;
            var scaninfo=scanstate.curinfo;
            /* Close off all of the open spans in the TOC */
            while (scaninfo) {
                scaninfo.ends_at=scanstate.location;
                scaninfo=scaninfo.head;}};
        
        return docinfo;}

    DOMScan.prototype.toJSON=function(){
        var rep={constructor: "mB.DOMScan",
                 frag: this.frag,
                 head: this.sbookhead,
                 start: this.starts_at,
                 end: this.ends_at};
        if (this.WSNID) rep.WSNID=this.WSNID;
        if (this.headstart) rep.headstart=this.headstart;
        if (this.toclevel) rep.toclevel=this.toclevel;
        if (this.title) rep.title=this.title;
        return JSON.stringify(rep);};
    
    DOMScan.getTOCLevel=getLevel;
    return DOMScan;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
