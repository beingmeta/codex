/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/toc.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements the "dynamic table of contents" for the Codex
   e-reader web application.

   This file is part of Codex, a Javascript/DHTML web application for reading
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

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
var Codex=((typeof Codex !== "undefined")?(Codex):({}));
var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.TOC=
    (function(){
        var fdjtString=fdjt.String;
        var fdjtState=fdjt.State;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtKB=fdjt.KB, fdjtID=fdjt.ID;
        
        var cxicon=Codex.icon;
        function navicon(kind){
            switch (kind) {
            case 'right': return cxicon("scan_right",64,64);
            case 'left': return cxicon("scan_left",64,64);
            case 'start': return cxicon("scan_left_stop",64,64);
            case 'end': return cxicon("scan_right_stop",64,64);
            default: return false;}}
        Codex.navicon=navicon;

        function CodexTOC(headinfo,depth,tocspec,prefix,headless){
            var progressbar=fdjtDOM("HR.progressbar");
            var head=((headless)?(false):
                      (fdjtDOM("A.sectname",headinfo.title)));
            var spec=tocspec||"DIV.codextoc";
            var next_button=
                ((head)&&
                 ((headinfo.next)?
                  (fdjtDOM.Image(navicon("right"),false,"next")):
                  (fdjtDOM.Image(navicon("end"),false,"nextstop"))));
            if ((next_button)&&(headinfo.next))
                next_button.frag=headinfo.next.frag;
            var back_button=
                ((head)&&
                 ((headinfo.prev)?
                  (fdjtDOM.Image(navicon("left"),false,"back")):
                  (fdjtDOM.Image(navicon("start"),false,"backstop"))));
            if ((back_button)&&(headinfo.prev))
                back_button.frag=headinfo.prev.frag;
            var toc=fdjtDOM(spec,
                            next_button,back_button,
                            ((head)&&(fdjtDOM("DIV.head",progressbar,head))),
                            generate_spanbar(headinfo),
                            generate_subsections(headinfo));
            var sub=headinfo.sub;
            if (!(depth)) depth=0;
            if (head) {
                head.name="SBR"+headinfo.frag;
                head.frag=headinfo.frag;}
            toc.sbook_start=headinfo.starts_at;
            toc.sbook_end=headinfo.ends_at;
            fdjtDOM.addClass(toc,"toc"+depth);
            toc.id=(prefix||"CODEXTOC4")+headinfo.frag;
            if ((!(sub))||(!(sub.length))) {
                fdjtDOM.addClass(toc,"codextocleaf");
                return toc;}
            var i=0; var n=sub.length;
            while (i<n) {
                toc.appendChild(CodexTOC(sub[i++],depth+1,spec,prefix,headless));}
            if (depth===0) {
                toc.title="Tap to go to this section; hold to preview it";
                fdjtUI.TapHold(toc,Codex.touch);
                Codex.UI.addHandlers(toc,'toc');}
            return toc;}
        
        function generate_subsections(headinfo) {
            var sub=headinfo.sub;
            if ((!(sub)) || (!(sub.length))) return false;
            var div=fdjtDOM("div.sub");
            var i=0; var n=sub.length;
            while (i<n) {
                var subinfo=sub[i];
                var subspan=fdjtDOM("A.sectname",subinfo.title);
                subspan.frag=subinfo.frag;
                subspan.name="SBR"+subinfo.frag;
                fdjtDOM(div,((i>0)&&" \u00b7 "),subspan);
                i++;}
            return div;}
        
        function generate_spanbar(headinfo){
            var spanbar=fdjtDOM("div.spanbar.codexslice");
            var spans=fdjtDOM("div.spans");
            var start=headinfo.starts_at;
            var end=headinfo.ends_at;
            var len=end-start;
            var subsections=headinfo.sub; var last_info;
            var sectnum=0; var percent=0;
            var head=headinfo.elt;
            spanbar.starts=start; spanbar.ends=end;
            if ((!(subsections)) || (subsections.length===0))
                return false;
            var progress=fdjtDOM("div.progressbox","\u00A0");
            var range=false; var lastspan=false;
            fdjtDOM(spanbar,progress,spans);
            fdjtDOM(spans,range);
            progress.style.left="0%";
            if (range) range.style.left="0%";
            var i=0; while (i<subsections.length) {
                var spaninfo=subsections[i++];
                var subsection=document.getElementById(spaninfo.frag);
                var spanstart; var spanend; var addname=true;
                if ((sectnum===0) && ((spaninfo.starts_at-start)>0)) {
                    /* Add 'fake section' for the precursor of the
                     * first actual section */
                    spanstart=start;  spanend=spaninfo.starts_at;
                    spaninfo=headinfo;
                    subsection=document.getElementById(headinfo.frag);
                    i--; sectnum++; addname=false;}
                else {
                    spanstart=spaninfo.starts_at; spanend=spaninfo.ends_at;
                    sectnum++;}
                var span=generate_span(
                    sectnum,subsection,spaninfo.title,spanstart,spanend,len,
                    ((addname)&&("SBR"+spaninfo.frag)),start);
                lastspan=span;
                spans.appendChild(span);
                if (addname) {
                    var anchor=fdjtDOM("A.codextitle",spaninfo.title);
                    anchor.name="SBR"+spaninfo.frag;
                    spans.appendChild(anchor);}
                last_info=spaninfo;}
            if ((end-last_info.ends_at)>0) {
                /* Add 'fake section' for the content after the last
                 * actual section */
                var span=generate_span
                (sectnum,head,headinfo.title,last_info.ends_at,end,len,start);
                spanbar.appendChild(span);}    
            return spanbar;}

        function generate_span(sectnum,subsection,title,
                               spanstart,spanend,len,name,pstart){
            var spanlen=spanend-spanstart;
            var anchor=fdjtDOM("A.brick","\u00A0");
            var span=fdjtDOM("DIV.codexhudspan",anchor);
            var width=(Math.round(100000000*(spanlen/len))/1000000);
            var left=(Math.round(100000000*((spanstart-pstart)/len))/1000000);
            span.style.left=left+"%";
            span.style.width=width+"%";
            span.title=(title||"section")+
                " ("+Math.round(left)+"%-"+(Math.round(left+width))+"%); "+
                "tap to jump here, hold to preview";
            span.frag=subsection.id;
            if (name) anchor.name=name;
            return span;}

        function getTOCPrefix(string){
            var fourpos=string.indexOf("4");
            if (fourpos) return string.slice(0,fourpos+1);
            else return string;}

        var hasClass=fdjtDOM.hasClass;
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var getChildren=fdjtDOM.getChildren;

        function updateTOC(head,tocroot){
            var prefix=getTOCPrefix(tocroot.id);
            var cur=(getChildren(tocroot,".codexcurhead"));
            var live=(getChildren(tocroot,".codexlivehead"));
            var cxt=(getChildren(tocroot,".codexcxthead"));
            dropClass(tocroot,"codexcxthead");
            dropClass(tocroot,"codexcurhead");
            dropClass(cur,"codexcurhead");
            dropClass(live,"codexlivehead");
            dropClass(cxt,"codexcxthead");
            if (!(head)) return;
            var base_elt=document.getElementById(prefix+head.frag);
            var toshow=[]; var base_info=head;
            while (head) {
                var tocelt=document.getElementById(prefix+head.frag);
                if (tocelt) toshow.push(tocelt);
                head=head.head;}
            var n=toshow.length-1;
            if ((base_info.sub)&&(base_info.sub.length))
                addClass(base_elt,"codexcxthead");
            else if (toshow[1]) addClass(toshow[1],"codexcxthead");
            else {}
            // Go backwards to accomodate some redisplayers
            while (n>=0) {
                var show=toshow[n--];
                if ((show.tagName==='A')&&
                    (show.className.search(/\bbrick\b/)>=0))
                    addClass(show.parentNode,"codexlivehead");
                addClass(show,"codexlivehead");}
            addClass(base_elt,"codexcurhead");}
        CodexTOC.updateTOC=updateTOC;

        CodexTOC.setHead=function setHead(headinfo){
            var livetitles=(fdjtDOM.$("a.codexlivehead.codextitle"));
            var i=0; var lim=livetitles.length;
            while (i<lim) livetitles[i++].style.fontSize='';
            var tocs=fdjtDOM.$(".toc0");
            var i=0; var lim=tocs.length;
            while (i<lim) { updateTOC(headinfo,tocs[i++]);}
            if (!(headinfo)) {
                addClass(tocs,"codexlivehead");
                addClass(tocs,"codexcurhead");
                return;}
            var head=headinfo;
            while (head) {
                var refs=document.getElementsByName("SBR"+head.frag);
                addClass(refs,"codexlivehead");
                var j=0; var jlim=refs.length;
                while (j<jlim) {
                    var ref=refs[j++];
                    if ((ref.tagName==='A')&&(ref.className)&&
                        (ref.className.search(/\bbrick\b/)>=0))
                        addClass(ref.parentNode,"codexlivehead");}
                head=head.head;}
            setTimeout(function(){scaleTitles(headinfo);},200);}

        function scaleTitles(headinfo){
            // Now, autosize the titles
            var head=headinfo;
            while (head) {
                var refs=document.getElementsByName("SBR"+head.frag);
                var j=0; var nrefs=refs.length;
                while (j<nrefs) {
                    var elt=refs[j++];
                    if ((elt.tagName==='A')&&(hasClass(elt,"codextitle"))) {
                        var cw=elt.clientWidth, sw=elt.scrollWidth;
                        if (sw>cw) elt.style.fontSize=(80*(cw/sw))+"%";}}
                head=head.head;}}
            
        return CodexTOC;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
