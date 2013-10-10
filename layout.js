/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/layout.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements the layout component of Codex, relying heavily
   on CodexLayout from the FDJT library.

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
/* jshint browser: true */
/* global Codex: false */

/* Reporting progress, debugging */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
// var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
// var Codex=((typeof Codex !== "undefined")?(Codex):({}));
// var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
// var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.Paginate=
    (function(){
        "use strict";

        var fdjtString=fdjt.String;
        var fdjtState=fdjt.State;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtID=fdjt.ID;
        var CodexLayout=fdjt.CodexLayout;

        var getGeometry=fdjtDOM.getGeometry;
        var getParent=fdjtDOM.getParent;
        var getChildren=fdjtDOM.getChildren;
        var hasClass=fdjtDOM.hasClass;
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var TOA=fdjtDOM.toArray;
        var textWidth=fdjtDOM.textWidth;
        var hasText=fdjtDOM.hasText;
        var isEmpty=fdjtString.isEmpty;
        var secs2short=fdjtTime.secs2short;
        
        var atoi=parseInt;

        function Paginate(why,init){
            if (((Codex.layout)&&(!(Codex.layout.done)))) return;
            if (!(why)) why="because";
            dropClass(document.body,"cxSCROLL");
            addClass(document.body,"cxLAYOUT");
            var forced=((init)&&(init.forced));
            var geom=getGeometry(fdjtID("CODEXPAGE"),false,true);
            var height=geom.inner_height, width=geom.width;
            var bodysize=Codex.bodysize||"normal";
            var bodyfamily=Codex.bodyfamily||"serif";
            if (Codex.layout) {
                var current=Codex.layout;
                if ((!(forced))&&
                    (width===current.width)&&
                    (height===current.height)&&
                    (bodysize===current.bodysize)&&
                    (bodyfamily===current.bodyfamily)) {
                    dropClass(document.body,"cxLAYOUT");
                    fdjtLog("Skipping redundant pagination for %s",
                            current.layout_id);
                    return;}
                // Repaginating, start with reversion
                Codex.layout.Revert();
                Codex.layout=false;}

            // Create a new layout
            var layout_args=getLayoutArgs();
            var layout=new CodexLayout(layout_args);
            layout.bodysize=bodysize; layout.bodyfamily=bodyfamily;
            Codex.layout=layout;
            
            var layout_id=layout.layout_id;

            // Get the document info
            var docinfo=Codex.docinfo;

            function restore_layout(content,layout_id){
                fdjtLog("Using saved layout %s",layout_id);
                fdjtID("CODEXCONTENT").style.display='none';
                dropClass(document.body,"cxSCROLL");
                addClass(document.body,"cxBYPAGE");
                layout.restoreLayout(content);
                getPageTops(layout.pages);
                fdjtID("CODEXPAGE").style.visibility='';
                fdjtID("CODEXCONTENT").style.visibility='';
                dropClass(document.body,"cxLAYOUT");
                Codex.layout=layout;
                Codex.pagecount=layout.pages.length;
                if (Codex.Trace.startup)
                    fdjtLog("Restored saved layout %s, adding glossmarks",
                            layout_id);
                var lostids=layout.lostids, moved_ids=lostids._all_ids;
                var i=0, lim=moved_ids.length;
                while (i<lim) {
                    var addGlossmark=Codex.UI.addGlossmark;
                    var id=moved_ids[i++];
                    var glosses=Codex.glossdb.find('frag',id);
                    if (!((glosses)&&(glosses.length))) continue;
                    var j=0, jlim=glosses.length; while (j<jlim) {
                        var gloss=Codex.glossdb.probe(glosses[j++]);
                        if (gloss) {
                            var nodes=Codex.getDups(gloss.frag);
                            addClass(nodes,"glossed");
                            var k=0, klim=nodes.length; while (k<klim) {
                                addGlossmark(nodes[k++],gloss);}}}}
                if (Codex.Trace.startup)
                    fdjtLog("Finished adding glossmarks to saved layout");
                setupPageInfo();
                if (Codex.layoutdone) {
                    var fn=Codex.layoutdone;
                    Codex.layoutdone=false;
                    fn();}
                Codex.GoTo(
                    Codex.location||Codex.target||
                        Codex.cover||Codex.titlepage||
                        fdjtID("CODEXPAGE1"),
                    "endLayout",false,false);
                Codex.layout.running=false;

                return false;}
            
            function new_layout(){
                // Prepare to do the layout
                dropClass(document.body,"cxSCROLL");
                addClass(document.body,"cxBYPAGE");
                fdjtID("CODEXPAGE").style.visibility='hidden';
                fdjtID("CODEXCONTENT").style.visibility='hidden';
                
                // Now make the content (temporarily) the same width as
                // the page
                var saved_width=Codex.content.style.width;
                Codex.content.style.width=getGeometry(Codex.page).width+"px";
                
                // Now walk the content
                var content=Codex.content;
                var nodes=TOA(content.childNodes);
                fdjtLog("Laying out %d root nodes into %dx%d pages (%s)",
                        nodes.length,layout.width,layout.height,
                        (why||""));
                
                // Do the adjust font bit.  We rely on Codex.content
                //  having the same width as Codex.page
                fdjt.DOM.adjustFonts(content);
                
                // Now reset the width
                Codex.content.style.width=saved_width;
                
                /* Lay out the coverpage */
                var coverpage=Codex.getCover();
                if (coverpage) layout.addContent(coverpage);

                var i=0; var lim=nodes.length;
                function rootloop(){
                    if (i>=lim) {
                        layout.Finish();
                        layout_progress(layout);
                        if (Codex.cachelayouts) {
                            var elapsed=layout.done-layout.started;
                            if (elapsed>(Codex.layoutcachethresh||5000)) {
                                layout.saveLayout();}}
                        getPageTops(layout.pages);
                        fdjtID("CODEXPAGE").style.visibility='';
                        fdjtID("CODEXCONTENT").style.visibility='';
                        dropClass(document.body,"cxLAYOUT");
                        Codex.layout=layout;
                        Codex.pagecount=layout.pages.length;
                        setupPageInfo();
                        if (Codex.layoutdone) {
                            var fn=Codex.layoutdone;
                            Codex.layoutdone=false;
                            fn();}
                        Codex.GoTo(
                            Codex.location||Codex.target||
                                Codex.cover||Codex.titlepage||
                                fdjtID("CODEXPAGE1"),
                            "endLayout",false,false);
                        Codex.layout.running=false;
                        return false;}
                    else {
                        var root=nodes[i++];
                        var timeslice=
                            layout.timeslice||CodexLayout.timeslice||100;
                        var timeskip=
                            layout.timeskip||CodexLayout.timeskip||50;
                        if (((root.nodeType===3)&&
                             (!(isEmpty(root.nodeValue))))||
                            ((root.nodeType===1)&&
                             (root.tagName!=='LINK')&&(root.tagName!=='META')&&
                             (root.tagName!=='SCRIPT')&&(root.tagName!=='BASE'))) 
                            layout.addContent(root,timeslice,timeskip,
                                              layout.tracelevel,
                                              layout_progress,rootloop);
                        else return rootloop();}}

                /* Reporting progress, debugging */
                
                function layout_progress(info){
                    var tracelevel=info.tracelevel;
                    var started=info.started;
                    var pagenum=info.pagenum;
                    var now=fdjtTime();
                    if (!(pagenum)) return;
                    var indicator=fdjtID("CODEXLAYOUTINDICATOR");
                    if (info.done) {
                        if (indicator)
                            indicator.style.width=Math.floor(pct)+"%";
                        fdjtDOM.replace(
                            "CODEXPAGENOTEXT",
                            fdjtDOM("div.pageno#CODEXPAGENOTEXT",
                                    Codex.curpage||"?",
                                    "/",pagenum," (",Math.floor(pct),
                                    "%)"));
                        layoutMessage(fdjtString(
                            "Finished laying out %d %dx%d pages in %s",
                            pagenum,
                            secs2short((info.done-info.started)/1000)));
                        fdjtLog("Finished laying out %d %dx%d pages in %s",
                                pagenum,info.width,info.height,
                                secs2short((info.done-info.started)/1000));}
                    else {
                        if ((info.lastid)&&(Codex.docinfo)&&
                            ((Codex.docinfo[info.lastid]))) {
                            var docinfo=Codex.docinfo;
                            var maxloc=docinfo._maxloc;
                            var lastloc=docinfo[info.lastid].starts_at;
                            var pct=(100*lastloc)/maxloc;
                            if (indicator)
                                indicator.style.width=Math.floor(pct)+"%";
                            fdjtDOM.replace(
                                "CODEXPAGENOTEXT",
                                fdjtDOM("div.pageno#CODEXPAGENOTEXT",
                                        Codex.curpage||"?",
                                        "/",pagenum," (",Math.floor(pct),
                                        "%)"));
                            fdjtUI.ProgressBar.setProgress(
                                "CODEXLAYOUTMESSAGE",pct);
                            layoutMessage(fdjtString(
                                "Laid out %d pages (%d%%) in %s",
                                pagenum,Math.floor(pct),
                                secs2short((now-started)/1000)));
                            if (tracelevel)
                                fdjtLog("Laid out %d pages (%d%%) in %s",
                                        pagenum,Math.floor(pct),
                                        secs2short((now-started)/1000));}
                        else {
                            layoutMessage(fdjtString(
                                "Laid out %d pages in %s",
                                info.pagenum,secs2short((now-started)/1000)));
                            if (tracelevel)
                                fdjtLog("Laid out %d pages in %s",
                                        info.pagenum,secs2short((now-started)/1000));}}}
                
                function layoutMessage(msg){
                    fdjtUI.ProgressBar.setMessage("CODEXLAYOUTMESSAGE",msg);}
                
                rootloop();}

            function getPageTop(node) {
                if (hasClass(node,"codexpage")) {}
                else if ((node.id)&&(docinfo[node.id])) {
                    if (hasText(node)) return node;}
                else if ((node.codexbaseid)&&(docinfo[node.codexbaseid])) {
                    if (hasText(node)) return node;}
                else {}
                var children=node.childNodes;
                if (children) {
                    var i=0; var lim=children.length;
                    while (i<lim) {
                        var child=children[i++];
                        if (child.nodeType===1) {
                            var first=getPageTop(child);
                            if (first) return first;}}}
                return false;}
            
            function getDupNode(under,id){
                var children;
                if (under.nodeType!==1) return false;
                else if (under.codexbaseid===id) return under;
                if (!(children=under.childNodes))
                    return false;
                else if (!(children.length)) return false;
                else {
                    var i=0, lim=children.length;
                    while (i<lim) {
                        var found=getDupNode(children[i++],id);
                        if (found) return found;}}}

            function getLocOff(pages,topstart,topnode){
                var id=topstart.id; var locoff=0;
                var pagescan=topstart, pagenum, elt=topstart;
                while (pagescan) {
                    if (hasClass(pagescan,"codexpage")) {
                        break;}
                    else pagescan=pagescan.parentNode;}
                if (!(pagescan)) return locoff;
                else pagenum=parseInt(pagescan.getAttribute("data-pagenum"),10);
                while ((elt)&&(elt!==topnode)) {
                    var width=textWidth(elt);
                    if (width) locoff=locoff+width;
                    pagescan=pages[++pagenum];
                    if (pagescan) elt=getDupNode(pagescan,id);}
                return locoff;}
            
            function getPageTops(pages){
                var j=0, jlim=pages.length, running=0;
                while (j<jlim) {
                    var page=pages[j++];
                    var topnode=getPageTop(page);
                    if (topnode) {
                        var topstart=document.getElementById(
                            topnode.codexbaseid||topnode.id);
                        var locoff=((topstart===topnode)?(0):
                                    (getLocOff(pages,topstart,topnode)));
                        var id=topstart.id; var info=docinfo[id];
                        page.setAttribute("data-topid",id);
                        page.setAttribute(
                            "data-sbookloc",info.starts_at+locoff);
                        running=info.starts_at+locoff;}
                    else {
                        page.setAttribute("data-sbookloc",running);}}}


            if ((Codex.cachelayouts)&&(!((Codex.forcelayout)))) {
                CodexLayout.fetchLayout(layout_id,function(content){
                    if (content)
                        restore_layout(content,layout_id);
                    else new_layout();});}
            else setTimeout(new_layout,10);}
        Codex.Paginate=Paginate;

        CodexLayout.prototype.onresize=function(){
            var view_height=fdjtDOM.viewHeight();
            fdjtID("CODEXHEART").style.maxHeight=(view_height-100)+'px';
            if (Codex.bypage) Codex.Paginate("resize");
            else fdjt.DOM.adjustFonts(Codex.content);
            fdjt.DOM.adjustFonts(Codex.HUD);};
       
        Codex.addConfig(
            "layout",
            function(name,val){
                Codex.page_style=val;
                if (val==='bypage') {
                    if (!(Codex.docinfo)) {
                        // If there isn't any docinfo (during startup, for
                        // instance), don't bother actually paginating.
                        Codex.bypage=true;}
                    else if (!(Codex.bypage)) {
                        // set this
                        Codex.bypage=true;
                        if (Codex.postconfig)
                            // If we're in the middle of config,
                            // push off the work of paginating
                            Codex.postconfig.push(Paginate);
                        // Otherwise, paginate away
                        else Codex.Paginate("config");}}
                else {
                    // If you've already paginated, revert
                    if (Codex.layout) {
                        Codex.layout.Revert();
                        Codex.layout=false;}
                    else if (((Codex.layout)&&(!(Codex.layout.done)))) {
                        if (Codex.layout.timer) {
                            clearTimeout(Codex.layout.timer);
                            Codex.layout.timer=false;}
                        Codex.layout.Revert();
                        Codex.layout=false;}
                    Codex.bypage=false;
                    if (Codex.layout) {
                        Codex.layout.Revert();
                        Codex.layout=false;}
                    dropClass(document.body,"cxBYPAGE");
                    addClass(document.body,"cxSCROLL");
                    fdjt.DOM.adjustFonts(Codex.content);}});

        function updateLayoutProperty(name,val){
            // This updates layout properties
            fdjtDOM.swapClass(
                Codex.body,new RegExp("codex"+name+"\\w*"),"codex"+name+val);
            Codex[name]=val;
            Codex.sizeContent();
            if (Codex.layout) {
                // If you're already paginated, repaginate.  Either
                // when done with the config or immediately.
                if (Codex.postconfig) {
                    Codex.postconfig.push(function(){
                        // Codex.setMode(true);
                        Codex.Paginate(name);});}
                else {
                    // Codex.setMode(true);
                    Codex.Paginate(name);}}}
        Codex.addConfig("bodysize",updateLayoutProperty);
        Codex.addConfig("bodyfamily",updateLayoutProperty);
        
        function getLayoutArgs(){
            var height=getGeometry(fdjtID("CODEXPAGE"),false,true).inner_height;
            var width=getGeometry(fdjtID("CODEXPAGE"),false,true).width;
            var container=fdjtDOM("div.codexpages#CODEXPAGES");
            var bodysize=Codex.bodysize||"normal";
            var bodyfamily=Codex.bodyfamily||"serif";
            var sourceid=Codex.sourceid;
            var layout_id=fdjtString(
                "%dx%d-%s-%s(%s)",
                width,height,bodysize,bodyfamily,
                // Layout depends on the actual file ID, if we've got
                // one, rather than just the REFURI
                sourceid||Codex.refuri);

            var saved_sourceid=
                fdjtState.getLocal("codex.sourceid("+Codex.refuri+")");
            if ((saved_sourceid)&&(sourceid)&&(sourceid!==sourceid)) {
                var layouts=fdjtState.getLocal("fdjtCodex.layouts",true);
                var kept=[];
                if (layouts) {
                    var pat=new RegExp("\\("+saved_sourceid+"\\)$");
                    var i=0, lim=layouts.length; while (i<lim) {
                        var cacheid=layouts[i++];
                        if (cacheid.search(pat)>0)
                            CodexLayout.dropLayout(cacheid);
                        else kept.push(cacheid);}}
                if (kept.length)
                    fdjtState.setLocal("fdjtCodex.layouts",kept);
                else fdjtState.dropLocal("fdjtCodex.layouts",kept);}
            
            if (sourceid)
                fdjtState.setLocal("codex.sourceid("+Codex.refuri+")",sourceid);
            
            var args={page_height: height,page_width: width,
                      container: container,pagerule: Codex.CSS.pagerule,
                      tracelevel: Codex.Trace.layout,
                      layout_id: layout_id,
                      logfn: fdjtLog};
            fdjtDOM.replace("CODEXPAGES",container);
            Codex.pages=container;
            
            var avoidbreakclasses=
                /\b(sbookfullpage)|(sbooktitlepage)|(stanza)\b/;
            args.avoidbreakinside=[avoidbreakclasses];
            avoidbreakclasses=
                fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
            if (avoidbreakclasses) args.avoidbreakinside.push(avoidbreakclasses);
            avoidbreakclasses=
                fdjtDOM.sel(fdjtDOM.getMeta("SBOOKS.avoidbreakinside",true));
            if (avoidbreakclasses) args.avoidbreakinside.push(avoidbreakclasses);

            var fbb=fdjtDOM.getMeta("alwaysbreakbefore",true).concat(
                fdjtDOM.getMeta("SBOOKS.alwaysbreakbefore",true)).concat(
                    fdjtDOM.getMeta("forcebreakbefore",true)).concat(
                        fdjtDOM.getMeta("SBOOKS.forcebreakbefore",true));
            if ((fbb)&&(fbb.length)) args.forcebreakbefore=fdjtDOM.sel(fbb);

            var fba=fdjtDOM.getMeta("alwaysbreakafter",true).concat(
                fdjtDOM.getMeta("SBOOKS.alwaysbreakafter",true)).concat(
                    fdjtDOM.getMeta("forcebreakafter",true)).concat(
                        fdjtDOM.getMeta("SBOOKS.forcebreakafter",true));
            if ((fba)&&(fba.length)) args.forcebreakafter=fdjtDOM.sel(fba);

            var abb=fdjtDOM.getMeta("avoidbreakbefore",true).concat(
                fdjtDOM.getMeta("SBOOKS.avoidbreakbefore",true)).concat(
                    fdjtDOM.getMeta("dontbreakbefore",true)).concat(
                        fdjtDOM.getMeta("SBOOKS.dontbreakbefore",true));
            if ((abb)&&(abb.length)) args.avoidbreakbefore=fdjtDOM.sel(abb);

            var aba=fdjtDOM.getMeta("avoidbreakafter",true).concat(
                fdjtDOM.getMeta("SBOOKS.avoidbreakafter",true)).concat(
                    fdjtDOM.getMeta("dontbreakafter",true)).concat(
                        fdjtDOM.getMeta("SBOOKS.dontbreakafter",true));
            if ((aba)&&(aba.length)) args.avoidbreakafter=fdjtDOM.sel(aba);

            var abi=fdjtDOM.getMeta("avoidbreakinside",true).concat(
                fdjtDOM.getMeta("SBOOKS.avoidbreakinside",true)).concat(
                    fdjtDOM.getMeta("dontbreakinside",true)).concat(
                        fdjtDOM.getMeta("SBOOKS.dontbreakinside",true));
            if ((abi)&&(abi.length)) args.avoidbreakinside=fdjtDOM.sel(abi);

            var fullpages=[".sbookfullpage",".sbooktitlepage",".sbookpage"].concat(
                fdjtDOM.getMeta("SBOOKS.fullpage",true)).concat(
                    fdjtDOM.getMeta("SBOOKS.fullpage",true)).concat(
                        fdjtDOM.getMeta("sbookfullpage",true));
            if ((fullpages)&&(fullpages.length))
                args.fullpages=fdjtDOM.sel(fullpages);
            
            var floatpages=[".sbookfloatpage"].concat(
                fdjtDOM.getMeta("SBOOKS.floatpage",true)).concat(
                    fdjtDOM.getMeta("SBOOKS.floatpage",true)).concat(
                        fdjtDOM.getMeta("sbookfloatpage",true));
            if ((floatpages)&&(floatpages.length))
                args.floatpages=fdjtDOM.sel(floatpages);
            
            var floating=[".sbookfloatpage"].concat(
                fdjtDOM.getMeta("SBOOKS.floatpage",true)).concat(
                    fdjtDOM.getMeta("SBOOKS.floatpage",true)).concat(
                        fdjtDOM.getMeta("sbookfloatpage",true));
            if ((floating)&&(floating.length))
                args.floating=fdjtDOM.sel(floating);

            var scaletopage=fdjtDOM.getMeta("sbookscaletopage",true);
            if ((scaletopage)&&(scaletopage.length)) 
                scaletopage.concat([".sbookscaletopage",".sbookpagescaled"]);
            else scaletopage=[".sbookscaletopage",".sbookpagescaled"];
            args.scaletopage=scaletopage=scaletopage;
            
            if ((fdjtDOM.getMeta("Codex.dontbreakblocks"))||
                (fdjtDOM.getMeta("Codex.keepblocks"))||
                (fdjtDOM.getMeta("~=Codex.dontbreakblocks"))||
                (fdjtDOM.getMeta("~=Codex.keepblocks"))||
                (fdjtDOM.getMeta("~dontbreakblocks"))||
                (fdjtDOM.getMeta("~keepblocks")))
                args.break_blocks=false;
            else args.break_blocks=true;
            
            if ((fdjtDOM.getMeta("Codex.dontscalepages"))||
                (fdjtDOM.getMeta("~=Codex.dontscalepages"))||
                (fdjtDOM.getMeta("dontscalepages")))
                args.scale_pages=false;
            else args.scale_pages=true;

            args.dontsave=fdjt.DOM.Selector(".codexglossmark");
            
            return args;}
        CodexLayout.getLayoutArgs=getLayoutArgs;

        /* Updating the page display */

        function updatePageDisplay(pagenum,location,classname) {
            if (!(classname)) classname="current";
            var npages=Codex.pagecount;
            var page_elt=fdjt.ID("CODEXPAGESPAN"+pagenum);
            var cur=getChildren("CODEXPAGEINFO","."+classname);
            if (cur[0]!==page_elt) {
                dropClass(cur,classname);
                addClass(page_elt,classname);}
            var locoff;
            if (typeof location==='number') {
                var max_loc=Codex.ends_at;
                var pct=(100*location)/max_loc;
                // This is (very roughly) intended to be the precision needed
                //  for line level (40 character) accuracy.
                var prec=Math.round(Math.log(max_loc/40)/Math.log(10))-2;
                if (prec<0) prec=0;
                locoff=fdjtDOM(
                    "span.locoff#CODEXLOCPCT",
                    fdjtString.precString(pct,prec)+"%");
                locoff.title=location+"/"+max_loc;}
            else locoff=fdjtDOM("span.locoff#CODEXLOCPCT");
            var pageno_text=fdjtDOM(
                "span#CODEXPAGENOTEXT.pageno",pagenum,"/",npages);
            fdjtDOM.replace("CODEXPAGENOTEXT",pageno_text);
            fdjtDOM.replace("CODEXLOCPCT",locoff);
            locoff.title=
                ((locoff.title)||"")+
                ((locoff.title)?("; "):(""))+
                "click to jump to a percentage location in the book";
            fdjtDOM.addListeners(
                locoff,Codex.UI.handlers[Codex.ui]["#CODEXLOCPCT"]);
            pageno_text.title="click to jump to a particular page";
            fdjtDOM.addListeners(
                pageno_text,Codex.UI.handlers[Codex.ui]["#CODEXPAGENOTEXT"]);}
        Codex.updatePageDisplay=updatePageDisplay;
        
        /* Page info */
        
        function setupPageInfo(){
            var i=0, n=Codex.pagecount; var html=[];
            var pagemax=fdjt.ID("CODEXGOTOPAGEMAX");
            if (pagemax) pagemax.innerHTML=""+n;
            var spanwidth=
                (fdjtID("CODEXPAGEINFO").offsetWidth)/n;
            if (spanwidth<1) spanwidth=1;
            if (Codex.CSS.pagespanrule)
                Codex.CSS.pagespanrule.style.width=spanwidth+"px";
            else Codex.CSS.pagespanrule=fdjtDOM.addCSSRule(
                "div.pagespans > span","width: "+spanwidth+"px;");
            while (i<n) {
                html.push("<span id='CODEXPAGESPAN"+(i+1)+"' "+
                          "class='pagespan' "+
                          "title='p"+(i+1)+". Hold to glimpse, tap to jump' "+
                          "style='left: "+(100*(i/n))+"%'"+
                          ">"+(i+1)+"</span>");
                i++;}
            var spans=fdjtID("CODEXPAGESPANS");
            spans.innerHTML=html.join("");
            var outer_width=getGeometry(spans);
            var inner_width=fdjt.DOM.getInsideBounds(spans);
            var tweak=outer_width/inner_width;
            spans.style[fdjt.DOM.transform]="scale("+tweak+",1)";}
        Codex.setupPageInfo=setupPageInfo;
        
        /* Movement by pages */
        
        var curpage=false;
        
        function GoToPage(spec,caller,savestate,skiphist){
            if (typeof savestate === 'undefined') savestate=true;
            if (Codex.previewing) stopPreview("GoToPage",false);
            dropClass(document.body,"codexhelp");
            var page=(Codex.layout)&&
                (Codex.layout.getPage(spec)||Codex.layout.getPage(1));
            if (page) {
                var pagenum=parseInt(page.getAttribute("data-pagenum"),10);
                var dirclass=false;
                if (Codex.Trace.flips)
                    fdjtLog("GoToPage/%s Flipping to %o (%d) for %o",
                            caller,page,pagenum,spec);
                if (!(curpage)) 
                    addClass(page,"curpage");
                else {
                    var curnum=parseInt(curpage.getAttribute("data-pagenum"),10);
                    dropClass(curpage,/(oldpage|newpage|onleft|onright)/g);
                    dropClass(page,/(oldpage|newpage|onleft|onright)/g);
                    if (pagenum<curnum) dirclass="onleft"; else dirclass="onright";
                    if (dirclass) addClass(page,dirclass);
                    addClass(curpage,"oldpage");
                    addClass(page,"newpage");
                    var lastpage=curpage;
                    setTimeout(function(){
                        dropClass(lastpage,"curpage");
                        addClass(page,"curpage");
                        dropClass(page,"newpage");
                        dropClass(page,"onright");},
                               50);
                    setTimeout(function(){
                        dropClass(lastpage,"oldpage");},
                               500);}
                if (typeof spec === 'number') {
                    var location=parseInt(page.getAttribute("data-sbookloc"),10);
                    Codex.setLocation(location);}
                updatePageDisplay(pagenum,Codex.location);
                curpage=page; Codex.curpage=pagenum;
                var curnode=fdjtID(page.getAttribute("data-topid"));
                if (savestate) {
                    Codex.point=curnode;
                    if (!((Codex.hudup)||(Codex.mode))) Codex.scanning=false;
                    Codex.setHead(curnode);}
                if ((savestate)&&(page)) {
                    Codex.saveState(
                        {location: atoi(page.getAttribute("data-sbookloc"),10),
                         page: atoi(page.getAttribute("data-pagenum"),10),
                         target: ((curnode)&&
                                  ((curnode.getAttribute("data-baseid"))||(curnode.id)))},
                        skiphist);}
                var glossed=fdjtDOM.$(".glossed",page);
                if (glossed) {
                    var addGlossmark=Codex.UI.addGlossmark;
                    var i=0; var lim=glossed.length;
                    while (i<lim) addGlossmark(glossed[i++]);}}}
        Codex.GoToPage=GoToPage;
        

        /** Previewing **/

        var previewing=false;
        function startPreview(spec,caller){
            var page=((spec.nodeType)&&(getParent(spec,".codexpage")))||
                Codex.layout.getPage(spec)||
                Codex.layout.getPage(1);
            if (!(page)) return;
            var pagenum=parseInt(page.getAttribute("data-pagenum"),10);
            var pageloc=parseInt(page.getAttribute("data-sbookloc"),10);
            if (previewing===page) return;
            if (previewing) dropClass(previewing,"previewpage");
            dropClass(getChildren(Codex.pages,".previewpage"),
                      "previewpage");
            if ((Codex.Trace.flips)||(Codex.Trace.gestures))
                fdjtLog("startPagePreview/%s to %o (%d) for %o",
                        caller||"nocaller",page,pagenum,spec);
            if (curpage) addClass(curpage,"hidepage");
            // Using this timeout here avoids some glitches
            addClass(page,"previewpage");
            Codex.previewing=previewing=page;
            addClass(document.body,"cxPREVIEW");
            updatePageDisplay(pagenum,pageloc,"preview");}
        function stopPreview(caller,target){
            var pagenum=parseInt(curpage.getAttribute("data-pagenum"),10);
            if ((Codex.Trace.flips)||(Codex.Trace.gestures))
                fdjtLog("stopPagePreview/%s from %o to %o (%d)",
                        caller||"nocaller",previewing,curpage,pagenum);
            var newpage=false;
            if (!(previewing)) return;
            if (target) {
                dropClass(curpage,"curpage");
                dropClass(curpage,"hidepage");
                addClass(previewing,"curpage");
                if (hasClass(target,"codexpage")) newpage=target;
                else newpage=getParent(target,".codexpage");}
            else {
                dropClass(previewing,"preview");
                dropClass(curpage,"hidepage");}
            dropClass(previewing,"previewpage");
            dropClass(getChildren(Codex.pages,".previewpage"),
                      "previewpage");
            Codex.previewing=previewing=false;
            dropClass(document.body,"cxPREVIEW");
            if (newpage) {
                var newnum=parseInt(newpage.getAttribute("data-pagenum"),10);
                var newloc=Codex.getLocInfo(target);
                updatePageDisplay(newnum,((newloc)&&(newloc.starts_at)),
                                  "current");}
            else updatePageDisplay(pagenum,Codex.location,"current");
            if (typeof newpage === "number") Codex.GoToPage(newpage);}
        Codex.startPagePreview=startPreview;
        Codex.stopPagePreview=stopPreview;

        function getPage(arg){
            if (!(Codex.layout)) return -1;
            var page=Codex.layout.getPage(arg)||Codex.layout.getPage(1);
            return parseInt(page.getAttribute("data-pagenum"),10);}
        Codex.getPage=getPage;
        
        function displaySync(){
            if ((Codex.pagecount)&&(Codex.curpage))
                Codex.GoToPage(Codex.curpage,"displaySync");}
        Codex.displaySync=displaySync;

        // We handle this ourselves
        fdjt.UI.adjustFont.onresize=false;

        return Paginate;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
