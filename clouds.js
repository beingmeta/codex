/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/clouds.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

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
    var fdjtString=fdjt.String;
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

    function makeCloud(tags,scores,freqs,n,completions,init_dom) {
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
        fdjtDOM.prepend(dom,maxmsg);
        
        if (!(completions)) completions=new Completions(dom);
        
        var info=organize_tags(tags,scores,knodule,sourcedb);
        var usecues=(n_terms>17)&& (// lots of terms AND
            (info.n_primes>0) || // there are prime terms OR
            (info.max!==info.min) || // scores are different OR
            // there are a small number of real concepts to use
            ((info.normals._count)<17) ||
                // there's are a lot of weak terms
                ((n_terms/info.normals._count)>4));
        if (!(usecues)) fdjtDOM.addClass(dom,"showempty");
        if (!(getChild(dom,".showall")))
            fdjtDOM.prepend(dom,getShowAll(usecues,n_terms));

        // Sort the tags before adding them
        tags=[].concat(tags);
        sort_tags(tags,Codex.empty_query.tagfreqs);

        // Compute score sum to get value for the cue threshold
        var score_sum=0; while (i<n_terms) {
            var score=scores.get(tags[i++]);
            if (score) score_sum=score_sum+score;}

        i=0; while (i<n_terms) {
            var dterm=tags[i++];
            var span=cloudSpan(completions,dterm,scores,freqs,score_sum/n_terms);
            dom.appendChild(span);
            dom.appendChild(document.createTextNode(" "));}
        sizeCloud(completions,scores,freqs,n,false);

        var end=new Date();
        if (Codex.Trace.clouds)
            fdjtLog("Made cloud for %d tags in %f seconds",
                    tags.length,(end.getTime()-start.getTime())/1000);

        // Put the cloud back into the flow (if neccessary)
        if (breadcrumb) breadcrumb.parentNode.replaceChild(dom,breadcrumb);

        return completions;}
    Codex.makeCloud=makeCloud;

    function cloudSpan(completions,dterm,scores,freqs,cuethresh){
        var freq=freqs.get(dterm)||1;
        var score=scores.get(dterm);
        var span=cloudEntry(completions,dterm);
        span.title=((score)?("score="+score):("unscored"))+"; "+
            "freq="+freq;
        if (freq===1) addClass(span,"singleton");        
        if (typeof cuethresh !== "number") {
            if (typeof dterm === "string") {}
            else if (dterm.prime) addClass(span,"cue");
            else {}}
        else if ((score)&&(score>cuethresh))
            addClass(span,"cue");
        else if (dterm.prime) addClass(span,"cue");
        else {}
        return span;}
    
    function cloudEntry(cloud,tag,lang){
        var entry;
        if (typeof lang !== "string")
            lang=(Codex.language)||(Knodule.language)||"EN";
        function initCloudEntry(){
            // This is called when the KNode is loaded
            var variations=false;
            if (tag instanceof KNode) {
                var knode=tag, dterm=knode.dterm;
                entry.setAttribute("key",dterm);
                entry.innerHTML=dterm;
                var synonyms=knode[lang];
                if ((synonyms)&&(typeof synonyms === 'string'))
                    synonyms=[synonyms];
                if (synonyms) {
                    var i=0; while (i<synonyms.length) {
                        var synonym=synonyms[i++];
                        if (synonym===dterm) continue;
                        var variation=fdjtDOM("span.variation",synonym,"=");
                        variation.setAttribute("key",synonym);
                        if (!(variations)) variations=fdjtDOM("span.variations");
                        variations.appendChild(variation);}}
                if (knode.weak) addClass(entry,"weak");
                if (knode.prime) {
                    addClass(entry,"prime");
                    addClass(entry,"cue");}
                if (knode.about) {
                    if (entry.title)
                        entry.title=entry.title+"; "+knode.about;
                    else entry.title=knode.about;}}
            else if (tag.name) {
                addClass(entry,"source"); addClass(entry,"account");
                entry.setAttribute("key",tag.name);
                entry.innerHTML=tag.name;}
            else if (tag.refuri) {
                addClass(entry,"doc");
                entry.setAttribute("key",tag.refuri);
                if (entry.title) cloud.addKeys(entry,entry.title);
                entry.innerHTML=tag.refuri;}
            else {}
            if (variations) fdjtDOM.prepend(entry,variations);
            cloud.addKeys(entry);}
        var existing=cloud.getByValue(tag,".completion");
        if ((existing)&&(existing.length)) return existing[0];
        else if (typeof tag === "string") {
            entry=fdjtDOM("span.completion.rawterm",tag);
            entry.setAttribute("value",tag);
            cloud.addCompletion(entry,tag,tag);
            return entry;}
        else if (!(tag instanceof Ref)) {
            var strungout=entry.toString();
            entry=fdjtDOM("span.completion.weirdterm",strungout);
            cloud.addCompletion(entry,strungout,tag);
            return entry;}
        else {
            var qid=tag._qid||tag.getQID();
            if (tag instanceof KNode) {
                entry=fdjtDOM("span.completion.dterm",qid);}
            else entry=fdjtDOM("span.completion",qid);
            if (tag.cssclass) addClass(entry,tag.cssclass);
            entry.setAttribute("value",qid);
            cloud.addCompletion(entry,false,tag);
            if (tag._live) {
                initCloudEntry();
                return entry;}}
        tag.onLoad(initCloudEntry);
        return entry;}
    Codex.cloudEntry=cloudEntry;
    
    function addTag2Cloud(tag,cloud,kb,scores,freqs,thresh){
        if (!(tag)) return;
        else if (tag instanceof Array) {
            var i=0; var lim=tag.length;
            while (i<lim) addTag2Cloud(tag[i++],cloud,kb,scores,freqs,thresh);
            return;}
        else {
            var container=cloud.dom;
            var tagref=(((typeof tag === 'string')&&(kb))?
                        ((RefDB.resolve(tag,kb||Codex.knodule,Knodule,false))||(tag)):
                        (tag));
            var entry=((scores)?
                       (cloudSpan(cloud,tagref,scores,freqs,thresh)):
                       (cloudEntry(cloud,tagref)));
            if (!(hasParent(entry,container))) fdjtDOM(container,entry," ");
            return entry;}}
    Codex.addTag2Cloud=addTag2Cloud;

    function getShowAll(use_cues,how_many){
        var showall=(use_cues)&&
            fdjtDOM(
                "span.showall",
                fdjtDOM("span.showmore","all"), 
                // ((how_many)&&(" ("+how_many+")"))
                fdjtDOM("span.showless","fewer"));
        if ((how_many)&&(showall))
            showall.title="There are "+how_many+" in all";
        if (showall) showall.onclick=showempty_ontap;
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

    function showempty_ontap(evt){
        var target=fdjtUI.T(evt);
        var completions=getParent(target,".completions");
        if (completions) {
            fdjtUI.cancel(evt);
            fdjtDOM.toggleClass(completions,"showempty");
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
                cotags,query.tagscores,query.tagfreqs,query.results.length);
            var cloud=completions.dom;
            cloud.onclick=searchcloud_ontap;
            var n_refiners=cotags.length;
            var hide_some=(n_refiners>Codex.show_refiners);
            if (hide_some) {
                var cues=fdjtDOM.$(".cue",cloud);
                if (!((cues)&&(cues.length))) {
                    var compelts=fdjtDOM.$(".completion",cloud);
                    var i=0; var lim=((compelts.length<Codex.show_refiners)?
                                      (compelts.length):(Codex.show_refiners));
                    while (i<lim) addClass(compelts[i++],"cue");}}
            else addClass(cloud,"showempty");
            query.cloud=completions;
            var tags=query.tags;
            if (tags) {
                var t=0, n_tags=tags.length; while (t<n_tags) {
                    var tag=tags[t++];
                    var e=completions.getByValue(tag);
                    addClass(e,"disabled");}}
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
    function sort_tags(tags,scores){
        tags.sort(function(x,y){
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
            else return 1;});}
    Codex.sortTags=sort_tags;
    
    function sortCloud(cloud,scores){
        var values=[].concat(cloud.values);
        sort_tags(values,scores);
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

    var precString=fdjtString.precString;

    function sizeCloud(cloud,scores,freqs,n,cuethresh){
        var values=cloud.values, byvalue=cloud.byvalue;
        var elts=new Array(values.length), vscores=new Array(values.length);
        var i=0, lim=values.length, min_score=-1, max_score=0, score_sum=0;
        if (cuethresh===true) {
            while (i<lim) {
                var sc=scores.get(values[i++]);
                if (sc) score_sum=score_sum+sc;}
            cuethresh=score_sum/values.length;}
        var global_scores=Codex.empty_query.tagscores;
        var total_results=Codex.empty_query.results.length;
        var tagweights=Codex.tagweights;
        i=0; while (i<lim) {
            var value=values[i], score=scores.get(value);
            var elt=elts[i]=byvalue.get(value);
            if ((value.prime)||(
                (typeof cuethresh === "number")&&(score>cuethresh)))
                addClass(elt,"cue");
            if (score) {
                if (scores!==global_scores) 
                    score=(score/n)/(global_scores.get(value)/total_results);
                else if (typeof value === "string") {
                    if (Codex.tagweights.get(value))
                        score=((freqs.get(value)/total_results)/
                               (tagweights.get(value)));
                    else score=0.01;}
                else {
                    var tw=((value.dterm)&&(tagweights.get(value.dterm)))||
                        ((value.norm)&&(tagweights.get(value.norm)));
                    if ((!(tw))&&(value.EN)) {
                        var synonyms=value.EN;
                        if (!(synonyms instanceof Array)) synonyms=[synonyms];
                        var s=0, slim=synonyms.length;
                        while (s<slim) {
                            if ((tw=tagweights.get(synonyms[s++]))) break;}}
                    if (tw) 
                        score=((score/total_results)/tw);
                    else score=0.01;}
                vscores[i]=score;
                if (score>max_score) max_score=score;
                if (min_score<0) min_score=score;
                else if (score<min_score) min_score=score;
                else {}}
            i++;}
        var sqrt=Math.sqrt; var minv=sqrt(min_score), maxv=sqrt(max_score);
        i=0; while (i<lim) {
            if (vscores[i]) {
                // var factor=((vscores[i]-min_score)/(max_score-min_score));
                // var factor=cloudWeight(vscores[i],min_score,max_score);
                var factor=sqrt(vscores[i])/(maxv-minv);
                var pct=50+150*factor;
                var node=elts[i]; var freq=freqs.get(values[i]);
                var title=((hasClass(node,"prime"))?("prime concept, "):
                           (hasClass(node,"weak"))?("weak concept, "):
                           (hasClass(node,"rawterm"))?("raw text, "):
                           ("concept, "));
                var nscore=vscores[i];
                title=title+((freq)&&(freq+" items; "))+
                    "score="+((nscore>0.01)?(precString(nscore,2)):
                              (nscore>0.001)?(precString(nscore,3)):
                              (nscore>0.0001)?(precString(nscore,4)):
                              (nscore));
                //title=title+" in ["+min_score+","+max_score+"]";
                // title=title+"; factor="+factor;
                // title=title+"; pct="+pct+"%";
                node.title=title;
                node.style.fontSize=pct+"%";}
            i++;}}
    Codex.sizeCloud=sizeCloud;

    function searchcloud_ontap(evt){
        evt=evt||event;
        var target=fdjtDOM.T(evt);
        var completion=getParent(target,".completion");
        if (hasClass(completion,"disabled")) {
            if (Codex.Trace.gestures)
                log("cloud tap on disabled %o",completion);
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
            fdjtDOM.toggleClass(completions,"showempty");
            fdjtDOM.cancel(evt);}
        else if (fdjtDOM.inherits(target,".maxcompletemsg")) {
            fdjtID("CODEXSEARCHINPUT").focus();
            fdjtDOM.toggleClass(completions,"showempty");
            fdjtDOM.cancel(evt);}
        else {}}
    Codex.UI.handlers.searchcloud_ontap=searchcloud_ontap;

    function add_searchtag(value){
        Codex.setQuery(Codex.extendQuery(Codex.query,value));}

    Codex.UI.searchCloudToggle=function(){
        fdjtDOM.toggleClass(fdjtID('CODEXSEARCHCLOUD'),'showempty');
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
        i=0, lim=newcues.length; while (i<lim) {
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
