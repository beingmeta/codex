/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/clouds.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file implements the search component for the e-reader web
   application, and relies heavily on the Knodules module.

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

(function(){
    "use strict";
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var fdjtID=fdjt.ID;
    var RefDB=fdjt.RefDB, Ref=fdjt.Ref;
    var KNode=Knodule.KNode;

    Codex.search_cloud=false;
    if (!(Codex.empty_cloud)) Codex.empty_cloud=false;
    if (!(Codex.show_refiners)) Codex.show_refiners=25;
    if (!(Codex.search_gotlucky)) Codex.search_gotlucky=7;
    
    var Completions=fdjtUI.Completions;
    var addClass=fdjtDOM.addClass;
    var dropClass=fdjtDOM.dropClass;
    var getChildren=fdjtDOM.getChildren;
    var getChild=fdjtDOM.getChild;
    var getParent=fdjtDOM.getParent;
    var hasParent=fdjtDOM.hasParent;
    var hasClass=fdjtDOM.hasClass;
    var log=fdjtLog;
    var kbref=RefDB.resolve;

    function makeCloud(tags,scores,freqs,n,completions,init_dom,roots) {
        var start=new Date();
        var sourcedb=Codex.sourcedb;
        var knodule=Codex.knodule;
        var dom=init_dom||false;
        var i=0; var n_terms=tags.length;
        // Move it out of the flow
        var breadcrumb=false;
        if ((dom)&&(dom.parentNode)) {
            breadcrumb=document.createTextNode("");
            dom.parentNode.replaceChild(breadcrumb,dom);}
        if (dom) addClass(dom,"completions");
        else if ((completions)&&(completions.dom))
            dom=completions.dom;
        else dom=fdjtDOM("div.completions.cloud",getShowAll(usecues,n_terms));
        var maxmsg=fdjtDOM(
            "div.maxcompletemsg",
            "There are a lot ","(",fdjtDOM("span.completioncount","really"),")",
            " of completions.  ");
        var emptymsg=fdjtDOM("div.nomatchmsg","(no matches)");
        fdjtDOM.prepend(dom,emptymsg,maxmsg);
        
        if (!(completions)) completions=new Completions(dom);

        var info=organize_tags(tags,scores,knodule,sourcedb);
        var usecues=(n_terms>17)&& (// lots of terms AND
            (info.n_primes>0) || // there are prime terms OR
            (info.max!==info.min) || // scores are different OR
            // there are a small number of real concepts to use
            ((info.normals._count)<17) ||
                // there's are a lot of weak terms
                ((n_terms/info.normals._count)>4));
        if (!(usecues)) fdjtDOM.addClass(dom,"showall");
        if (!(getChild(dom,".showall")))
            fdjtDOM.prepend(dom,getShowAll(usecues,n_terms));

        // Sort the tags before adding them
        tags=[].concat(tags);
        sort_tags(tags);

        // Compute score sum to get value for the cue threshold
        var score_sum=0; while (i<n_terms) {
            var score=scores.get(tags[i++]);
            if (score) score_sum=score_sum+score;}

        i=0; while (i<n_terms) {
            var dterm=tags[i++];
            var span=cloudSpan(
                dterm,completions,scores,freqs,score_sum/n_terms);
            dom.appendChild(span);
            dom.appendChild(document.createTextNode(" "));}
        sizeCloud(completions,scores,roots);

        var end=new Date();
        if (Codex.Trace.clouds)
            fdjtLog("Made cloud for %d tags in %f seconds",
                    tags.length,(end.getTime()-start.getTime())/1000);

        // Put the cloud back into the flow (if neccessary)
        if (breadcrumb) breadcrumb.parentNode.replaceChild(dom,breadcrumb);

        return completions;}
    Codex.makeCloud=makeCloud;

    function cloudSpan(dterm,completions,scores,freqs){
        var freq=freqs.get(dterm)||1;
        var score=scores.get(dterm);
        var span=cloudEntry(dterm,completions);
        var title=span.title;
        if (freq) {
            if (title) title=title+"; count="+freq;
            else title="count="+freq;}
        if ((score)&&(score!==freq)) title=title+"; s="+score;
        span.title=title;
        if (freq===1) addClass(span,"singleton");
        else if (freq===2) addClass(span,"doubleton");
        else {}
        return span;}
    
    function initCloudEntry(tag,entry,cloud,lang){
        // This is called when the KNode is loaded
        var variations=false, suffix=false;
        if (tag instanceof KNode) {
            var knode=tag, dterm=knode.dterm, origin=false;
            if (tag._db===Codex.knodule) origin="index";
            else if (tag._db.fullname) {
                origin=tag._db.fullname; suffix=fdjtDOM("sup","*");}
            else {
                var sourceref=Codex.sourcedb.probe(tag._db.name);
                if (sourceref) {
                    origin=tag._db.fullname=sourceref.name;
                    suffix=fdjtDOM("sup","*");}
                else {
                    origin="glosses";
                    suffix=fdjtDOM("sup","*");}}
            entry.setAttribute("data-key",dterm);
            if (typeof suffix === "string")
                entry.innerHTML=dterm+suffix;
            else if (suffix) {
                entry.innerHTML=dterm;
                entry.appendChild(suffix);}
            else entry.innerHTML=dterm;
            var synonyms=knode[lang];
            if ((synonyms)&&(typeof synonyms === 'string'))
                synonyms=[synonyms];
            if (synonyms) {
                var i=0; while (i<synonyms.length) {
                    var synonym=synonyms[i++];
                    if (synonym===dterm) continue;
                    var variation=fdjtDOM("span.variation",synonym,"=");
                    variation.setAttribute("data-key",synonym);
                    if (!(variations)) variations=fdjtDOM("span.variations");
                    variations.appendChild(variation);}}
            if (knode.prime) {
                addClass(entry,"prime");
                addClass(entry,"cue");}
            else if (knode.weak) addClass(entry,"weak");
            else {}
            var noun=((dterm.search(/\.\.\.$/)>0)?("root form"):("concept"));
            var title=
                ((knode.prime)?("key "):
                 (knode.weak)?("weak "):(""))+
                ((origin==="index")?("index "+noun+" "):
                 (noun+" (from "+origin+") "));
            if (knode.about)
                title=title+knode.dterm+": "+knode.about;
            else {
                var def=knode.toPlaintext();
                if ((def)&&(def!==knode.dterm))
                    title=title+knode.dterm+"="+knode.toPlaintext();
                else title=title+"'"+knode.dterm+"'";}
            entry.title=title;}
        else if (tag.name) {
            addClass(entry,"source"); addClass(entry,"account");
            entry.setAttribute("data-key",tag.name);
            entry.innerHTML=tag.name;}
        else if (tag.refuri) {
            addClass(entry,"doc");
            entry.setAttribute("data-key",tag.refuri);
            if ((cloud)&&(entry.title))
                cloud.addKeys(entry,entry.title);
            entry.innerHTML=tag.refuri;}
        else {}
        if (variations) fdjtDOM.prepend(entry,variations);
        if (cloud) cloud.addKeys(entry);}
    function initCloudEntries(tag){
        var droplets=tag.droplets;
        if (droplets) {
            var i=0, lim=droplets.length; 
            while (i<lim) {
                var droplet=droplets[i++];
                initCloudEntry(tag,droplet.entry,droplet.cloud,droplet.lang);}
            delete tag.droplets;}}

    function cloudEntry(tag,cloud,lang){
        var entry;
        if (typeof lang !== "string")
            lang=(Codex.language)||(Knodule.language)||"EN";
        var existing=(cloud)&&(cloud.getByValue(tag,".completion"));
        if ((existing)&&(existing.length)) return existing[0];
        else if (typeof tag === "string") {
            var isrootform=tag.search(/\.\.\.$/)>0;
            var spec="span.completion"+
                ((isrootform)?(".rootform"):(".rawterm"))+
                ((tag.length>20)?(".longterm"):(""));
            entry=fdjtDOM(spec,"\u201c"+tag+"\u201d");
            if (isrootform)
                entry.title="forms "+tag;
            else entry.title=tag;
            if (cloud) cloud.addCompletion(entry,tag,tag);
            return entry;}
        else if (!(tag instanceof Ref)) {
            var strungout=entry.toString();
            entry=fdjtDOM(((strungout.length>20)?
                           ("span.completion.weirdterm.longterm"):
                           ("span.completion.weirdterm")),
                          "?"+strungout+"\u00bf");
            entry.title=strungout;
            if (cloud) cloud.addCompletion(entry,strungout,tag);
            return entry;}
        else {
            var qid=tag._qid||tag.getQID();
            // Section names as tags
            if ((tag instanceof KNode)&&(qid[0]==="\u00A7")) {
                var sectname=tag._id.slice(1), showname;
                if (sectname.length>20)
                    showname=fdjtDOM(
                        "span.name.ellipsis",sectname.slice(0,20),
                        fdjtDOM("span.elision","\u2026"),
                        fdjtDOM("span.elided",sectname.slice(20)));
                else showname=fdjtDOM("span.name",sectname);
                entry=fdjtDOM("span.completion.sectname","\u00A7",showname);
                entry.setAttribute("data-key",sectname);
                entry.setAttribute("data-value",tag._qid||tag.getQID());
                if (sectname.length>24) addClass(entry,"longterm");
                if (sectname.length>20) entry.title=sectname;
                if (cloud) cloud.addCompletion(entry,sectname,tag);
                return entry;}
            else if (tag instanceof KNode) 
                entry=fdjtDOM(((qid.length>20)?
                               ("span.completion.dterm.longterm"):
                               ("span.completion.dterm")),
                              qid);
            else entry=fdjtDOM(((qid.length>20)?
                                ("span.completion.longterm"):
                                ("span.completion")),
                               qid);
            if (tag.cssclass) addClass(entry,tag.cssclass);
            entry.setAttribute("data-value",qid);
            if (cloud) cloud.addCompletion(entry,false,tag);
            if (tag._live) {
                initCloudEntry(tag,entry,cloud,lang);
                return entry;}
            else if (tag.droplets)
                tag.droplets.push({entry: entry,lang: lang,cloud: cloud});
            else {
                tag.droplets=[{entry: entry,lang: lang,cloud: cloud}];
                tag.onLoad(initCloudEntries);
                return entry;}}}
    Codex.cloudEntry=cloudEntry;
    
    function addTag2Cloud(tag,cloud,kb,scores,freqs,thresh){
        if (!(kb)) kb=Codex.knodule;
        if (!(tag)) return;
        else if (tag instanceof Array) {
            var i=0; var lim=tag.length;
            while (i<lim) addTag2Cloud(tag[i++],cloud,kb,scores,freqs,thresh);
            return;}
        else {
            var container=cloud.dom;
            var tagref=(((typeof tag === 'string')&&(kb))?
                        ((RefDB.resolve(tag,kb,Knodule,false))||(tag)):
                        (tag));
            var entry=((scores)?
                       (cloudSpan(tagref,cloud,scores,freqs,thresh)):
                       (cloudEntry(tagref,cloud)));
            if (!(hasParent(entry,container))) fdjtDOM(container,entry," ");
            return entry;}}
    Codex.addTag2Cloud=addTag2Cloud;

    function getShowAll(use_cues,how_many){
        var showall=(use_cues)&&
            fdjtDOM(
                "span.showall",
                fdjtDOM("span.showmore","more"), 
                // ((how_many)&&(" ("+how_many+")"))
                fdjtDOM("span.showless","fewer"));
        if ((how_many)&&(showall))
            showall.title="There are "+how_many+" in all";
        if (showall) showall.onclick=showall_ontap;
        return showall;}
    Codex.UI.getShowAll=getShowAll;

    function organize_tags(tags,scores,knodule,sourcedb){
        var min_score=false, max_score=false;
        var normals={}, n_normal=0, n_primes=0;
        var i=0; while (i<tags.length) {
            var tag=tags[i++];
            if (tag instanceof Ref) {
                if (tag.prime) n_primes++;
                if ((tag._db!==sourcedb)&&(!(tag.weak))) {
                    normals[tag]=true; n_normal++;}}
            if (scores) {
                var score=scores.get(tag);
                if (score) {
                    if (min_score===false) min_score=score;
                    else if (score<min_score) min_score=score;
                    if (score>max_score) max_score=score;}}}
        normals._count=n_normal;
        return {normals: normals, n_primes: n_primes,
                min: min_score, max: max_score};}

    function showall_ontap(evt){
        var target=fdjtUI.T(evt);
        var completions=getParent(target,".completions");
        if (completions) {
            fdjtUI.cancel(evt);
            fdjtDOM.toggleClass(completions,"showall");
            setTimeout(function(){
                Codex.UI.updateScroller(completions);},
                       100);}}

    /* Getting query cloud */

    function queryCloud(query){
        if (Codex.mode==="expandsearch") return Codex.empty_cloud;
        else if (query.cloud) return query.cloud;
        else if ((query.tags.length)===0) {
            query.cloud=Codex.empty_cloud;
            return query.cloud;}
        else {
            var cotags=query.getCoTags();
            var completions=makeCloud(
                cotags,query.tagscores,query.tagfreqs,
                cotags.length,false,false,query.tags);
            var cloud=completions.dom;
            addClass(cloud,"searchcloud");
            cloud.onclick=searchcloud_ontap;
            var n_refiners=cotags.length;
            var hide_some=(n_refiners>Codex.show_refiners);
            if (hide_some) {
                var ranked=[].concat(cotags);
                var scores=query.tagscores;
                ranked.sort(function(x,y){
                    if (((typeof x === "string")&&(typeof y === "string"))||
                        ((x instanceof Ref)&&(y instanceof Ref))) {
                        var xs=scores.get(x), ys=scores.get(y);
                        if ((typeof xs === "number")&&
                            (typeof ys === "number")) 
                            return ys-xs;
                        else if (typeof xs === "number")
                            return -1;
                        else return 1;}
                    else if (typeof x === "string")
                        return 1;
                    else return -1;});
                var i=0, lim=Codex.show_refiners;
                while (i<lim) {
                    var tag=ranked[i++], elt=completions.getByValue(tag);
                    addClass(elt,"cue");}}
            else addClass(cloud,"showall");
            query.cloud=completions;
            return query.cloud;}}
    Codex.queryCloud=queryCloud;
    RefDB.Query.prototype.getCloud=function(){return queryCloud(this);};
    
    function tag_sorter(x,y,scores){
        // Knodes go before Refs go before strings
        // Otherwise, use scores
        if (x instanceof KNode) {
            if (y instanceof KNode) {} // Fall through
            else return -1;}
        else if (y instanceof KNode) return 1;
        else if (x instanceof Ref) { 
            if (y instanceof Ref) {} // Fall through
            else return -1;}
        else if (y instanceof Ref) return 1;
        else if ((typeof x === "string")&&
                 (typeof y === "string"))
        {}
        // We should never reach these cases because tags should
        //  always be strings, Refs, or KNodes.
        else if  (typeof x === typeof y) {
            if (x<y) return -1;
            else if (x>y) return 1;
            else return 0;}
        else {
            var xt=typeof x, yt=typeof y;
            if (xt<yt) return -1;
            else if (xt>yt) return 1;
            else return 0;}
        var xv=scores.get(x), yv=scores.get(y);
        if (typeof xv === "undefined") {
            if (typeof yv === "undefined") {
                var xid, yid;
                if (typeof x === "string") {
                    xid=x; yid=y;}
                else {
                    xid=x._qid||x.getQID();
                    yid=y._qid||y.getQID();}
                if (xid<yid) return -1;
                else if (yid>xid) return 1;
                else return 0;}
            else return 1;}
        else if (typeof yv === "undefined") return -1;
        else if (xv===yv) {
            if (x<y) return -1;
            else if (x>y) return 1;
            else return 0;}
        else if (xv>yv) return -1;
        else return 1;}
    Codex.tag_sorter=tag_sorter;
    function sort_tags(tags){
        // Sort alphabetically, sort of
        tags.sort(function(x,y){
            var sx=x, sy=y;
            // Knodes go before Refs go before strings
            // Otherwise, use scores
            if (x instanceof KNode) {
                if (y instanceof KNode) {
                    sx=x.dterm; sy=y.dterm;}
                else return -1;}
            else if (y instanceof KNode) return 1;
            else if (x instanceof Ref) { 
                if (y instanceof Ref) {
                    sx=x._qid; sy=y._qid;}
                else return -1;}
            else if (y instanceof Ref) return 1;
            else if ((typeof x === "string")&&
                     (typeof y === "string")) {}
            else if (typeof x === "string") return -1;
            else if (typeof y === "string") return 1;
            // We should never reach these cases because tags should
            //  always be strings, Refs, or KNodes.
            else if  (typeof x === typeof y) {
                if (x<y) return -1;
                else if (x>y) return 1;
                else return 0;}
            else {
                var xt=typeof x, yt=typeof y;
                if (xt<yt) return -1;
                else if (xt>yt) return 1;
                else return 0;}
            if (sx.search(/\w/)>0) sx=sx.slice(sx.search(/\w/));
            if (sy.search(/\w/)>0) sy=sy.slice(sy.search(/\w/));
            if (sx<sy) return -1;
            else if (sx>sy) return 1;
            else return 0;});}
    Codex.sortTags=sort_tags;
    
    function sortCloud(cloud){
        var values=[].concat(cloud.values);
        sort_tags(values);
        var byvalue=cloud.byvalue;
        var holder=document.createDocumentFragment();
        var i=0, lim=values.length;
        while (i<lim) {
            var value=values[i++];
            var completion=byvalue.get(value);
            if (completion) {
                if (i>1) holder.appendChild(document.createTextNode(" "));
                holder.appendChild(completion);}}
        cloud.dom.appendChild(holder);}
    Codex.sortCloud=sortCloud;

    function sizeCloud(cloud,scores,roots){
        var gscores=Codex.tagscores;
        var gweights=Codex.tagweights;
        var values=cloud.values, byvalue=cloud.byvalue;
        var vscores=new Array(values.length);
        var i=0, lim=values.length;
        var min_score=-1, max_score=-1, sum=0, count=0;
        while (i<lim) {
            var value=values[i], score;
            if ((roots)&&(RefDB.contains(roots,value))) {
                vscores[i++]=false; continue;}
            if (scores) {
                var cscore=scores.get(value);
                var gscore=gscores.get(value);
                score=(cscore/gscore)*(gweights.get(value));}
            else score=gscores.get(value);
            if (typeof score === "number") {
                vscores[i]=score; sum=sum+score; count++;
                if ((min_score<0)||(score<min_score)) min_score=score;
                if ((max_score<0)||(score>max_score)) max_score=score;}
            else vscores[i]=false;
            i++;}
        if (Codex.Trace.clouds)
            fdjtLog("Sizing cloud %o using scores [%o,%o]",
                    cloud.dom,min_score,max_score);
        i=0; while (i<lim) {
            var v=values[i], s=vscores[i];
            var elt=byvalue.get(v);
            if (v.prime) {
                addClass(elt,"prime"); addClass(elt,"cue");}
            if (!(s)) {
                addClass(elt,"unscored");
                elt.style.fontSize=""; i++; continue;}
            else {}
            var factor=(s-min_score)/(max_score-min_score);
            var fsize=50+(150*factor);
            if ((roots)&&(RefDB.contains(roots,v))) {
                addClass(elt,"cloudroot");
                if (fsize<200)
                    elt.style.fontSize=Math.round(fsize)+"%";
                else elt.style.fontSize="200%";}
            else elt.style.fontSize=Math.round(fsize)+"%";
            i++;}}
    Codex.sizeCloud=sizeCloud;

    function searchcloud_ontap(evt){
        evt=evt||event;
        var target=fdjtDOM.T(evt);
        var completion=getParent(target,".completion");
        if (hasClass(completion,"cloudroot")) {
            if (Codex.Trace.gestures)
                log("cloud tap on cloudroot %o",completion);
            return;}
        if (Codex.Trace.gestures) log("cloud tap on %o",completion);
        var completions=getParent(target,".completions");
        if (completion) {
            var cinfo=Codex.query.cloud;
            var value=cinfo.getValue(completion);
            if (typeof value !== 'string') add_searchtag(value);
            else  if (value.length===0) {}
            else if (value.indexOf('@')>=0)
                add_searchtag(kbref(value));
            else if ((Codex.knodule)&&(Codex.knodule.probe(value)))
                add_searchtag(Codex.knodule.probe(value));
            else add_searchtag(value);
            fdjtUI.cancel(evt);}
        else if (fdjtDOM.inherits(target,".resultcounts")) {
            Codex.showSearchResults(Codex.query);
            Codex.setMode("searchresults");
            fdjtID("CODEXSEARCHINPUT").blur();
            fdjtID("CODEXSEARCHRESULTS").focus();
            fdjtUI.cancel(evt);}
        else if (fdjtDOM.inherits(target,".refinercounts")) {
            fdjtDOM.toggleClass(completions,"showall");
            fdjtDOM.cancel(evt);}
        else if (fdjtDOM.inherits(target,".maxcompletemsg")) {
            fdjtID("CODEXSEARCHINPUT").focus();
            fdjtDOM.toggleClass(completions,"showall");
            fdjtDOM.cancel(evt);}
        else {}}
    Codex.UI.handlers.searchcloud_ontap=searchcloud_ontap;

    function add_searchtag(value){
        Codex.setQuery(Codex.extendQuery(Codex.query,value));}

    Codex.UI.searchCloudToggle=function(){
        fdjtDOM.toggleClass(fdjtID('CODEXSEARCHCLOUD'),'showall');
        Codex.UI.updateScroller(fdjtID('CODEXSEARCHCLOUD'));};

    function setCloudCues(cloud,tags){
        // Clear any current tagcues from the last gloss
        var cursoft=getChildren(cloud.dom,".cue.softcue");
        var i=0; var lim=cursoft.length;
        while (i<lim) {
            var cur=cursoft[i++];
            dropClass(cur,"cue");
            dropClass(cur,"softcue");}
        // Get the tags on this element as cues
        var newcues=cloud.getByValue(tags);
        i=0; lim=newcues.length; while (i<lim) {
            var completion=newcues[i++];
            if (!(hasClass(completion,"cue"))) {
                addClass(completion,"cue");
                addClass(completion,"softcue");}}}
    function setCloudCuesFromTarget(cloud,target){
        var tags=[];
        var targetid=((target.codexbaseid)||(target.id)||(target.frag));
        var info=Codex.docinfo[targetid];
        var glosses=Codex.glossdb.find('frag',targetid);
        var knodule=Codex.knodule;
        if ((info)&&(info.tags)) tags=tags.concat(info.tags);
        if ((info)&&(info.autotags)&&(info.autotags.length)) {
            var autotags=info.autotags; var j=0; var jlim=autotags.length;
            while (j<jlim) {
                var kn=knodule.probe(autotags[j]);
                if (kn) tags.push(kn.tagString());
                j++;}}
        var i=0; var lim=glosses.length;
        while (i<lim) {
            var g=glosses[i++]; var gtags=g.tags;
            if (gtags) tags=tags.concat(gtags);}
        setCloudCues(cloud,tags);}
    Codex.setCloudCues=setCloudCues;
    Codex.setCloudCuesFromTarget=setCloudCuesFromTarget;
    


})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
