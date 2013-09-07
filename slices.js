/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/slices.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements the display of lists of glosses or summaries
   referring to book passages.

   This file is part of Codex, a Javascript/DHTML web application for reading
   large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.
   This file assumes that the sbooks.js file has already been loaded.

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

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
// var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
// var Codex=((typeof Codex !== "undefined")?(Codex):({}));
// var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
// var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.Slice=(function () {
    "use strict";
    
    var fdjtString=fdjt.String;
    var fdjtTime=fdjt.Time;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var RefDB=fdjt.RefDB, fdjtID=fdjt.ID;
    var Ref=RefDB.Ref;

    var addClass=fdjtDOM.addClass;
    var dropClass=fdjtDOM.dropClass;

    var debug_locbars=false;
    var odq="\u201c"; var cdq="\u201d";

    var cxicon=Codex.icon;
    var addListener=fdjtDOM.addListener;

    function renderCard(info,query,idprefix,standalone){
        var target_id=(info.frag)||(info.id);
        var target=((target_id)&&(fdjtID(target_id)));
        var target_info=Codex.docinfo[target_id];
        if (!(target_info)) return false;
        var head_info=((target_info.level)?(target_info):(target_info.head));
        var head=((head_info)&&(document.getElementById(head_info.frag)));
        var score=((query)&&(query.scores.get(info)));
        var excerpt_len=((info.excerpt)?(info.excerpt.length):(0));
        var note_len=((info.note)?(info.note.length):(0));
        var overdoc=getoverdoc(info);
        var shared=(info.shared)||[];
        if (typeof shared === 'string') shared=[shared];
        if (overdoc) shared=RefDB.remove(shared,(overdoc._qid||overdoc._id));
        var body=
            fdjtDOM("div.codexcardbody",
                    ((score)&&(showscore(score,query))),
                    (((info.maker)||(info.tstamp))?(showglossinfo(info)):
                     (showdocinfo(info))),
                    ((note_len>0)&&
                     (fdjtDOM("span.note",convertNote(info.note))))," ",
                    // (fdjtUI.Ellipsis("span.note",info.note,140))
                    ((info.detail)&&(fdjtDOM("span.detail","DETAIL")))," ",
                    ((excerpt_len>0)&&(showexcerpts(info.excerpt)))," ",
                    ((info.alltags)&&(showtags(info)))," ",
                    ((info.links)&&(showlinks(info.links)))," ",
                    ((info.attachments)&&
                     (showlinks(info.attachments,"span.attachments")))," ",
                    ((shared)&&(shared.length)&&(showaudience(shared))));
        var div=
            fdjtDOM(((info.maker) ?
                     "div.codexcard.gloss" :
                     "div.codexcard.passage"),
                    ((head)&&(makeTOCHead(head,((info.level)&&(info))))),
                    ((head_info)&&(makeIDHead(target,head_info))),
                    ((standalone)&&(makelocbar(target_info))),
                    body,
                    fdjtDOM("div.fdjtclearfloats"));
        var makerinfo=(info.maker);
        Codex.sourcedb.load(info.maker);
        var tstamp=info.tstamp||info.modified||info.created;
        if (tstamp)
            body.title=
            "gloss from "+(((makerinfo)&&(makerinfo.name))||"someone")+
            " at "+fdjtTime.shortString(tstamp);
        else {} // div.title=Codex.getTitle(target,true);
        div.about="#"+info.frag;
        div.setAttribute('data-passage',target_id);
        div.setAttribute('data-location',target_info.starts_at);
        if (head_info) div.setAttribute('data-tochead',head_info.frag);
        if ((info.maker)||(info.tstamp)) {
            div.setAttribute('data-gloss',info._id);
            if (info.tstamp)
                div.setAttribute('data-timestamp',info.tstamp);}
        if (score) div.setAttribute("data-searchscore",score);
        // div.setAttribute('about',"#"+info.id);
        if (idprefix) div.id=idprefix+info.id;
        if (info._id) {
            div.name=div.qref=info._id;
            div.setAttribute("name",info._id);}
        return div;}
    Codex.renderCard=renderCard;
    
    function convertNote(note){
        if (note.search(/^{(md|markdown)}/)==0) {
            var close=note.indexOf('}');
            return Codex.md2DOM(note.slice(close+1),true);}
        else return note;}

    var show_tag_thresh=7;

    function toarray(arg){
        if (!(arg)) return [];
        else if (arg instanceof Array) return arg;
        else return [arg];}
    function showtags(info){
        var tagicon=fdjtDOM.Image(cxicon("tagicon",64,64),
                                  "img.tagicon","tags");
        var span=fdjtDOM("span.tags.fdjtexpands",tagicon);
        var tagspan=span, hidden=false;
        var controller=false, hide_count_elt=false, total_count_elt=false, hide_start=false;
        var count=0, seen={}, i, lim;
        var tagvecs=[toarray(info["**tags"]),toarray(info["*tags"]),
                     toarray(info["+tags"]),toarray(info["+tags*"]),
                     toarray(info.knodes),toarray(info.tags),
                     toarray(info["**tags*"]),toarray(info["*tags*"]),
                     toarray(info["tags*"]),
                     toarray(info["~tags"]),toarray(info["~tags*"])];
        var j=0, nvecs=tagvecs.length;
        while (j<nvecs) {
            var tags=tagvecs[j++];
            i=0, lim=tags.length;
            while (i<tags.length) {
                var tag=tags[i++];
                if (!(tag)) continue;
                var tagstring=((typeof tag === "string")?(tag):((tag._qid)||(tag.getQID())));
                if (seen[tagstring]) continue;
                else {count++; seen[tagstring]=tag;}
                if ((!controller)&&(count>show_tag_thresh)) {
                    hide_count_elt=document.createTextNode("K");
                    total_count_elt=document.createTextNode("N");
                    controller=fdjtDOM("span.controller.clickable",
                                       fdjtDOM("span.whenexpanded","-",
                                               "hide ",hide_count_elt," tags"),
                                       fdjtDOM("span.whencollapsed","+",

                                               "all ",total_count_elt," tags"));
                    hidden=fdjtDOM("span.whenexpanded");
                    controller.setAttribute(
                        "onclick","fdjt.UI.Expansion.toggle(event); fdjt.UI.cancel(event);");
                    fdjtDOM(span," ",controller," ",hidden);
                    hide_start=count-1;
                    tagspan=hidden;}
                fdjtDOM.append(tagspan,((count>1)?" \u00b7 ":" "),
                               Knodule.HTML(tag,Codex.knodule));}}
        if ((count-hide_start)<(show_tag_thresh/2)) {
            fdjtDOM.remove(controller);
            fdjtDOM(span,[].concat(hidden.childNodes));}
        else {
            fdjtDOM.replace(total_count_elt,document.createTextNode(""+count));
            fdjtDOM.replace(hide_count_elt,document.createTextNode(""+(count-hide_start)));}
        return span;}

    function showaudience(outlets,spec){
        if (!(outlets instanceof Array)) outlets=[outlets];
        if (outlets.length===0) return false;
        var span=fdjtDOM(
            spec||((outlets.length>1)?("div.audience"):("span.audience")),
            ((outlets.length>1)&&
             (fdjtDOM("span.count",outlets.length, " outlets"))),
            " ");
        var i=0; var lim=outlets.length; while (i<lim) {
            var outlet=outlets[i]; var info=Codex.sourcedb.ref(outlet);
            var outlet_span=fdjtDOM("span.outlet");
            if (info._live) {
                fdjtDOM(outlet_span,info.name);
                if (info.about) 
                    outlet_span.title="Shared with “"+info.name+"” — "+info.about;
                else outlet_span.title="Shared with “"+info.name+"”";}
            else info.load(fill_outlet_span,[info,outlet_span]);
            fdjtDOM.append(span," ",outlet_span);
            i++;}
        return span;}
    function fill_outlet_span(info,outlet_span){
        fdjtDOM(outlet_span,info.name);
        if (info.about) 
            outlet_span.title="Shared with “"+info.name+"” — "+info.about;
        else outlet_span.title="Shared with “"+info.name+"”";}

    function showlinks(refs,spec){
        var count=0;
        for (var url in refs) if (url[0]==='_') continue; else count++;
        if (count===0) return false;
        var span=fdjtDOM(spec||((count>1)?("div.links"):("span.links")),
                         ((count>1)&&(fdjtDOM("span.count",count, " links"))),
                         " ");
        for (url in refs) {
            if (url[0]==='_') continue;
            var urlinfo=refs[url];
            var title; var icon=cxicon("diaglink",64,64);
            if (typeof urlinfo === 'string') title=urlinfo;
            else {
                title=urlinfo.title;
                icon=urlinfo.icon;}
            var image=fdjtDOM.Image(icon);
            var anchor=(fdjtDOM.Anchor(url,{title:"Link to "+url},image,title));
            anchor.target='_blank';
            fdjtDOM(span,anchor,"\n");}
        return span;}
    function showexcerpts(excerpts){
        if (typeof excerpts==='string')
            return fdjtUI.Ellipsis("span.excerpt",excerpts,140);
        else if (excerpts.length===1)
            return fdjtUI.Ellipsis("span.excerpt",excerpts[0],140);
        else {
            var ediv=fdjtDOM("div.excerpts");
            var i=0; var lim=excerpts.length;
            while (i<lim)
                fdjtDOM(ediv,
                        ((i>0)&&" "),
                        fdjtDOM("span.excerpt",odq,excerpts[i++],cdq));
            return ediv;}}
    function showscore(score,query){
        if ((query)&&(query.max_score))
            return fdjtDOM("span.score","(",score,"/",query.max_score,")");
        else return fdjtDOM("span.score","(",score,")");}
    function showglossinfo(info) {
        var user=info.maker;
        var userinfo=(user)&&(Codex.sourcedb.load(user));
        var agestring=timestring(info.modified||info.created||info.tstamp);
        var tool=fdjtDOM(
            "span.tool",
            fdjtDOM("span.age",agestring)," ",
            fdjtDOM.Image(
                (((user===Codex.user)||(user===Codex.user._id))?
                 (cxicon("gloss_edit_titled",40,40)):
                 (cxicon("gloss_respond_titled",40,40))),
                "img.button",
                (((user===Codex.user)||(user===Codex.user._id))?
                 ("edit"):("reply")),
                (((user===Codex.user)||(user===Codex.user._id))?
                 ("tap to edit this gloss, hold to reply"):
                 ("relay/reply to this gloss"))),
            ((info.private)&&(fdjtDOM("span.private","Private"))));
        addListener(tool,"tap",glossaction);
        addListener(tool,"release",glossaction);
        
        var picinfo=getpicinfo(info);
        var overdoc=getoverdoc(info);
        
        return [((picinfo)?
                 (fdjtDOM.Image(picinfo.src,picinfo.classname,picinfo.alt)):
                 (getfakepic(info.maker,"div.sourcepic"))),
                ((overdoc)&&(overdoc.name)&&
                 (fdjtDOM("span.overdoc",(overdoc.name)))),
                /* ((overdoc)&&(overdoc.name)&&(" \u00b7 ")), */
                (((!(overdoc))&&(userinfo)&&
                  ((userinfo.name)||(userinfo.userid)))&&
                 (fdjtDOM("span.user",((userinfo.name)||(userinfo.userid))))),
                ((!(overdoc))&&(userinfo)&&
                 ((userinfo.name)||(userinfo.userid))&&
                 (" \u2014 ")),
                tool];}
    function showdocinfo(info) {
        return fdjtDOM("span.marker",((info.toclevel)?("\u00a7"):("\u00b6")));}

    function getoverdoc(info){
        if (info.sources) {
            var sources=info.sources;
            if (typeof sources === 'string') sources=[sources];
            var i=0; var lim=sources.length;
            while (i<lim) {
                var source=Codex.sourcedb.loadref(sources[i++]);
                if ((source)&&(source.kind===':OVERDOC'))
                    return source;}
            return false;}
        else return false;}

    function getfakepic(maker,spec){
        var userinfo=Codex.sourcedb.loadref(maker);
        var pic=fdjtDOM(spec||"div.sbooksourcepic",
                        (((userinfo)&&(userinfo.name))?
                         (fdjtString.getInitials(userinfo.name)):
                         "?"));
        addClass(pic,"sbooknopic");
        return pic;}

    function getpicinfo(info){
        var i, lim;
        if (info.pic) return {src: info.pic,alt: info.pic};
        if (info.sources) {
            var sources=info.sources;
            if (typeof sources==='string') sources=[sources];
            i=0, lim=sources.length; while (i<lim) {
                var source=Codex.sourcedb.loadref(sources[i++]);
                if ((source)&&(source.kind===':OVERDOC')&&(source.pic))
                    return { src: source.pic, alt: source.name,
                             classname: "img.glosspic.sourcepic"};}}
        if (info.links) {
            var links=info.links;
            i=0, lim=links.length; while (i<lim) {
                var link=links[i++];
                if (link.href.search(/\.(jpg|png|gif|jpeg)$/i)>0)
                    return { src: link.href, alt: "graphic",
                             classname: "img.glosspic"};}}
        if (info.shared) {
            var outlets=info.shared;
            if (typeof outlets==='string') outlets=[outlets];
            i=0, lim=outlets.length; while (i<lim) {
                var outlet=Codex.sourcedb.loadref(outlets[i++]);
                if ((outlet)&&(outlet.kind===':OVERLAY')&&(outlet.pic))
                    return { src: outlet.pic, alt: outlet.name,
                             classname: "img.glosspic.sourcepic"};}}
        if (info.maker) {
            var userinfo=Codex.sourcedb.loadref(info.maker);
            if (userinfo.pic)
                return { src: userinfo.pic, alt: userinfo.name,
                         classname: "img.glosspic.userpic"};
            else if (userinfo.fbid)
                return {
                    src: "https://graph.facebook.com/"+
                        userinfo.fbid+"/picture?type=square",
                    classname: "img.glosspic.userpic.fbpic"};
            else return false;}
        else return false;}

    var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function timestring(tick){
        var now=fdjtTime.tick(), date=new Date(1000*tick);
        if ((now-tick)<(12*3600)) {
            var hour=date.getHours();
            var minute=date.getMinutes();
            return ""+hour+":"+((minute<10)?"0":"")+minute;}
        else {
            var year=date.getFullYear();
            var month=date.getMonth();
            var datenum=date.getDate();
            if (year<10)
                return ""+datenum+"/"+months[month]+"/0"+year;
            else return ""+datenum+"/"+months[month]+"/"+year;}}

    function makelocbar(target_info,cxt_info){
        var locrule=fdjtDOM("HR");
        var locbar=fdjtDOM("DIV.locbar",locrule);
        var target_start=target_info.starts_at;
        var target_end=target_info.ends_at;
        var target_len=target_end-target_start;
        if (!(cxt_info)) cxt_info=Codex.docinfo[document.body.id];
        var cxt_start=cxt_info.starts_at;
        var cxt_end=cxt_info.ends_at;
        var cxt_len=cxt_end-cxt_start;
        if (debug_locbars)
            locbar.setAttribute(
                "debug","ts="+target_start+"; te="+target_end+"; cl="+cxt_len);
        locrule.style.width=((target_len/cxt_len)*100)+"%";
        locrule.style.left=(((target_start-cxt_start)/cxt_len)*100)+"%";
        var id=target_info.id||target_info.frag;
        if (id) {
            locbar.about="#"+id;
            locbar.title=sumText(fdjtID(id));}
        return locbar;}

    function makelocrule(target_info,cxtinfo,spec){
        var tocrule=(!(cxtinfo));
        if (!(cxtinfo)) cxtinfo=Codex.docinfo[Codex.content.id];
        var locrule=fdjtDOM(spec||"hr.locrule");
        var cxt_start=cxtinfo.starts_at;
        var cxt_end=cxtinfo.ends_at;
        var cxt_len=cxt_end-cxt_start;
        var target_start=target_info.starts_at-cxt_start;
        var target_len=target_info.ends_at-target_info.starts_at;
        var locstring="~"+Math.ceil(target_len/5)+ " words long ~"+
            Math.ceil((target_start/cxt_len)*100)+"% along";
        locrule.setAttribute("about","#"+(target_info.id||target_info.frag));
        locrule.locstring=locstring+".";
        locrule.title=
            ((tocrule)?("this section in the book"):
             ("this passage in the section, "))+
            locstring+": click or hold to glimpse";
        locrule.style.width=((target_len/cxt_len)*100)+"%";
        locrule.style.left=((target_start/cxt_len)*100)+"%";
        return locrule;}
    function makelocstring(target_info,cxtinfo){
        var tocrule=(!(cxtinfo));
        if (!(cxtinfo)) cxtinfo=Codex.docinfo[Codex.content.id];
        var cxt_start=cxtinfo.starts_at;
        var cxt_end=cxtinfo.ends_at;
        var cxt_len=cxt_end-cxt_start;
        var target_start=target_info.starts_at-cxt_start;
        var target_len=target_info.ends_at-target_info.starts_at;
        if (tocrule)
            return "this section is ~"+Math.ceil(target_len/7)+
            " words long and ~"+Math.ceil((target_start/cxt_len)*100)+
            "% into the book";
        else return "this passage is ~"+Math.ceil(target_len/7)+
            " words long and ~"+Math.ceil((target_start/cxt_len)*100)+
            "% into the section";}

    function glossaction(evt){
        var target=fdjtUI.T(evt), scan=target;
        fdjtUI.cancel(evt);
        while (scan) {
            if (scan.qref) break;
            else scan=scan.parentNode;}
        if (!(scan)) return;
        var qref=scan.qref;
        var gloss=Codex.glossdb.ref(qref);
        var form=Codex.setGlossTarget(gloss,evt.type==="hold");
        if (!(form)) return;
        Codex.setMode("addgloss");}

    // Displayings sets of notes organized into threads

    function sumText(target){
        var title=Codex.getTitle(target,true);
        if (title.length<40) return title;
        /* title.slice(0,40)+"\u22ef "; */
        else return title;}
    
    function makeTOCHead(target,head){
        if (!(head)) head=Codex.getHead(target);
        var basespan=fdjtDOM("span");
        basespan.title='this location in the structure of the book';
        var title=Codex.getTitle(target,true);
        var info=Codex.docinfo[target.id];
        if (target!==head) {
            var paratext=
                fdjtDOM.Anchor("javascript:Codex.JumpTo('"+target.id+"');",
                               "a.paratext",
                               fdjtDOM("span.spacer","\u00B6"),
                               sumText(target));
            paratext.title='(click to jump to this passage) '+title;
            fdjtDOM(basespan,paratext," ");}
        if (head) {
            var text=sumText(head);
            var headtext=
                fdjtDOM.Anchor("javascript:Codex.JumpTo('"+head.id+"');",
                               "a.headtext",
                               fdjtDOM("span.spacer","\u00A7"),
                               text);
            var curspan=fdjtDOM("span.head",headtext);
            headtext.title='jump to the section: '+text;
            fdjtDOM.append(basespan," ",curspan);
            var heads=Codex.Info(head).heads;
            if (heads) {
                var j=heads.length-1; while (j>0) {
                    var hinfo=heads[j--]; var elt=fdjtID(hinfo.frag);
                    if ((!(elt))||(!(hinfo.title))||
                        (elt===Codex.docroot)||(elt===document.body))
                        continue;
                    var anchor=
                        fdjtDOM.Anchor(
                            "javascript:Codex.JumpTo('"+hinfo.frag+"');",
                            "a.headtext",
                            fdjtDOM("span.spacer","\u00A7"),
                            hinfo.title);
                    var newspan=fdjtDOM("span.head"," ",anchor);
                    anchor.title=
                        ((hinfo.title)?('jump to the section: '+hinfo.title):
                         "(jump to this section)");
                    if (target===head) fdjtDOM(curspan,newspan);
                    else fdjtDOM(curspan," \u22ef ",newspan);
                    curspan=newspan;}}}
        var tochead=fdjtDOM("div.tochead",
                            makelocrule(info,false),
                            basespan);
        tochead.title=makelocstring(info,false);
        return tochead;}

    function makeIDHead(target,headinfo){
        var info=Codex.docinfo[target.id];
        if (!(headinfo)) headinfo=info.head;
        var idhead=fdjtDOM("div.idhead",
                           makelocrule(info,headinfo),
                           fdjtDOM("span.spacer","\u00b6"),
                           fdjtDOM("span",sumText(target)));
        idhead.title=makelocstring(info,headinfo);
        return idhead;}

    Codex.nextSlice=function(start){
        var card=fdjtDOM.getParent(start,".codexcard");
        if (!(card)) return false;
        var scan=card.nextSibling;
        while (scan) {
            if ((scan.nodeType===1)&&(hasClass(scan,"codexcard")))
                return scan;
            else scan=scan.nextSibling;}
        return false;};
    Codex.prevSlice=function(start){
        var card=fdjtDOM.getParent(start,".codexcard");
        if (!(card)) return false;
        var scan=card.previousSibling;
        while (scan) {
            if ((scan.nodeType===1)&&(hasClass(scan,"codexcard")))
                return scan;
            else scan=scan.previousSibling;}
        return false;};

    /* Selecting a subset of glosses to display */

    var hasClass=fdjtDOM.hasClass;

    function selectSources(slice,sources){
        var sourcerefs=[], sourcedb=Codex.sourcedb;
        if ((!(sources))||(sources.length===0)) {
            slice.filter(false); return;}
        var i=0; var lim=sources.length; while (i<lim) {
            var source=sourcedb.ref(sources[i++]);
            if (source) sourcerefs.push(source);}
        slice.filter(function(card){
            var gloss=card.gloss;
            return ((gloss)&&
                    ((RefDB.contains(sourcerefs,gloss.maker))||
                     (RefDB.overlaps(sourcerefs,gloss.sources))||
                     (RefDB.overlaps(sourcerefs,gloss.shared))));});
        Codex.UI.updateScroller(slice.container);
        if (Codex.target) scrollGlosses(Codex.target,slice);}
    Codex.UI.selectSources=selectSources;

    /* Scrolling slices */

    function scrollGlosses(elt,slice,top){
        var container=slice.container;
        var cardinfo=slice.getCard(elt);
        if (cardinfo) {
            var scrollto=cardinfo.dom;
            if ((scrollto)&&((top)||(!(fdjtDOM.isVisible(scrollto))))) {
                if ((Codex.scrollers)&&(container.id)&&
                    (Codex.scrollers[container.id])) {
                    var scroller=Codex.scrollers[container.id];
                    scroller.scrollToElement(scrollto);}
                else scrollto.scrollIntoView(true);}}}
    Codex.UI.scrollGlosses=scrollGlosses;
    
    /* Results handlers */

    var named_slices={};

    function CodexSlice(container,cards,sortfn){
        if (typeof container === "undefined") return this;
        else if (!(this instanceof CodexSlice))
            return new CodexSlice(container,cards,sortfn);
        else if (!(container)) 
            container=fdjtDOM("div.codexslice");
        else if (typeof container === "string") {
            if (named_slices.hasOwnProperty(container))
                return named_slices[container];
            else if (document.getElementById(container)) 
                container=document.getElementById(container);
            else return false;}
        else if ((container.nodeType)&&
                 (container.nodeType===1)&&
                 (container.id)) {
            if (named_slices.hasOwnProperty(container.id))
                return named_slices[container.id];
            else named_slices[container.id]=container;}
        else if ((container.nodeType)&&(container.nodeType===1))  {}
        else return false;
        fdjtUI.TapHold(container,Codex.touch);
        Codex.UI.addHandlers(container,'summary');
        this.container=container; this.cards=[];
        if (sortfn) this.sortfn=sortfn;
        this.byid=new fdjt.RefMap();
        this.byfrag=new fdjt.RefMap();
        this.live=false; this.changed=false;
        this.addCards(cards);
        if ((cards)&&(cards.length)) this.update();
        return this;}

    CodexSlice.prototype.setLive=function setSliceLive(flag){
        if (flag) {
            if (this.live) return false;
            else {
                this.update();
                return true;}}
        else if (this.live) {
            this.live=false;
            return true;}
        else return false;};

    CodexSlice.prototype.renderCard=function renderCardForSlice(about){
        return renderCard(about);};

    CodexSlice.prototype.sortfn=function defaultSliceSortFn(x,y){
        if (x.location) {
            if (y.location) {
                if (x.location===y.location) {
                    if (x.timestamp) {
                        if (y.timestamp)
                            return x.timestamp-y.timestamp;
                        else return -1;}
                    else return 1;}
                else return x.location-y.location;}
            else return -1;}
        else return 1;};

    CodexSlice.prototype.getCard=function getCard(ref){
        if ((ref.nodeType===1)&&(hasClass(ref,"codexcard"))) {
            var id=ref.getAttribute("data-gloss")||
                ref.getAttribute("data-passage");
            return this.byid.get(id);}
        else if (ref.nodeType===1) {
            if (!(ref.id)) ref=getFirstID(ref);
            if (ref) return this.byid.get(ref.id)||this.byfrag.get(ref.id);}
        else return ((ref._qid)&&(this.byid.get(ref._qid)))||
            ((ref._id)&&(this.byid.get(ref._id)));};
    function getFirstID(node){
        if (node.id) return node;
        else if (node.childNodes) {
            var children=node.childNodes;
            var i=0; var lim=children.length; while (i<lim) {
                if (children[i].nodeType===1) {
                    var found=getFirstID(children[i++]);
                    if (found) return found;}
                else i++;}}
        return false;}

    CodexSlice.prototype.display=CodexSlice.prototype.update=
        function updateSlice(force){
            if ((!(this.changed))&&(!(force))) return;
            var cards=this.cards, byfrag=this.byfrag;
            cards.sort(this.sortfn);
            var passage_starts=
                fdjtDOM.toArray(fdjtDOM.$(".slicenewpassage",this.container));
            var head_starts=
                fdjtDOM.toArray(fdjtDOM.$(".slicenewhead",this.container));
            this.container.innerHTML="";
            dropClass(passage_starts,"slicenewpassage");
            dropClass(head_starts,"slicenewhead");
            var head=false, passage=false;
            var frag=document.createDocumentFragment()||this.container;
            var i=0, lim=cards.length; while (i<lim) {
                var card=cards[i++];
                if (card.hidden) continue;
                else if (card.passage!==passage) {
                    passage=card.passage;
                    byfrag[passage]=card;
                    addClass(card.dom,"slicenewpassage");}
                if (card.head!==head) {
                    head=card.head;
                    addClass(card.dom,"slicenewhead");}
                frag.appendChild(card.dom);}
            if (frag!==this.container) this.container.appendChild(frag);
            this.changed=false;};

    CodexSlice.prototype.filter=function filterSlice(fn){
        var cards=this.cards; var i=0, n=cards.length;
        if (!(fn)) while (i<n) delete cards[i++].hidden;
        else while (i<n) {
            var card=cards[i++];
            if (fn(card)) card.hidden=false;
            else card.hidden=true;}
        this.changed=true;
        this.update();};

    CodexSlice.prototype.addCards=function addCards(adds){
        if (!(adds)) return;
        if (!(adds instanceof Array)) adds=[adds];
        if (adds.length===0) return;
        var byid=this.byid, cards=this.cards; var i=0, lim=adds.length;
        while (i<lim) {
            var add=adds[i++], info=false, card, id, about=false, replace=false;
            if ((add.nodeType)&&(add.nodeType===1)&&(hasClass(add,"codexcard"))) {
                card=add; id=add.name||add.getAttribute("name");
                if (!(id)) continue;
                if ((info=byid[id])) {
                    if (info.dom!==add) replace=byid[id].dom;
                    card=add; info.dom=add;}
                else card=add;}
            else if (add instanceof Ref) {
                id=add._qid||add.getQID(); about=add;
                if (byid[id]) {info=byid[id]; card=info.dom;}
                else card=this.renderCard(add);}
            else {}
            if (!(card)) continue;
            if (!(about)) about=RefDB.resolve(id);
            if (!(info)) 
                byid[id]=info={added: fdjtTime(),id: id,about: about};
            info.dom=card;
            if (card.getAttribute("data-location"))
                info.location=parseInt(card.getAttribute("data-location"),10);
            if (card.getAttribute("data-gloss"))
                info.gloss=Codex.glossdb.refs[card.getAttribute("data-gloss")];
            if (card.getAttribute("data-searchscore"))
                info.score=parseInt(card.getAttribute("data-searchscore"),10);
            if (card.getAttribute("data-timestamp"))
                info.timestamp=parseInt(card.getAttribute("data-timestamp"),10);
            if (card.getAttribute("data-passage")) 
                info.passage=card.getAttribute("data-passage");
            if (card.getAttribute("data-tochead"))
                info.head=card.getAttribute("data-tochead");
            if (replace) this.container.replaceChild(card,replace);
            else cards.push(info);}
        if (this.live) this.update();
        else this.changed=true;};

    return CodexSlice;

})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
