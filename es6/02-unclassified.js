function extendWidget(superName, subName, opts) {
    return api.createWidget(subName, _.extends({}, opts, api.reopenWidget(superName, {})));
}

const GlobalState = Ember.Object.extend({
    currentPath: document.location.pathname,
    currentToolbar: null,
    showSearchbar: false
});

const globalState = GlobalState.create()

api.onPageChange((url, title)=> {
    globalState.set('currentPath', url)
    const appEvents = api.container.lookup('app-events:main');
    appEvents.trigger('msktheme:page-change')
})

function aClickHandler(e) {
    if (!e) {
        return true;
    }
    
    if (e.target.tagName === 'a' && e.target.getAttribute('data-auto-route') ===
        'true') {
        e.preventDefault();
        DiscourseURL.routeTo(e.target.getAttribute('href'));
        return false;
    }
    return true;
}

if (Discourse.User.current()) {
    Discourse.User.current().findDetails()
}

function getCurrentPath() {
    return globalState.get('currentPath')
}

function isSpecialTopicList() {
    const path = getCurrentPath()
    if (path === '/') return true
    return !!_.find(Discourse.Site.current().get('top_menu_items'),
        (item)=>(`/${item}` === path))
}

function isTopicList() {    
    const path = getCurrentPath()
    return isSpecialTopicList() || path.startsWith('/c/')||path.startsWith('/tags/')
}

function isTopic() {
    const path = getCurrentPath()
    return !!path.startsWith('/t/')
}

function getCurrentToolbar() {
    if (globalState.get('showSearchbar')) {
        return 'search'
    } else if (isTopicList()) {
        return 'topic-list'
    } else if (isTopic()) {
        return 'topic'
    }
}

globalState.set('currentToolbar',getCurrentToolbar())
globalState.addObserver('currentPath', function() {
    globalState.set('currentToolbar', getCurrentToolbar())
})
globalState.addObserver('showSearchbar', function() {
    globalState.set('currentToolbar', getCurrentToolbar())
})

const MainToolbarTemplate = {
    toolbarName: 'template',
    buildClasses() {
        return ['left']
    },
    changeToolbar(name) {
        globalState.set('currentToolbar', name)
    }
}

api.createWidget('mdmaintoolbar-search-button', {
	tagName: 'div#search-button.md-button.right',
	buildClasses() {
	    if (globalState.get('showSearchbar')) {
	        return ['active']
	    } else {
	        return []
	    }
	},
	html() {
        if (!globalState.get('showSearchbar')) {
		    return mdIcon('magnify')
        } else {
            return mdIcon('close')
        }
	},

    click(e) {
        if (!e) {
            return true;
        } else if (e.type === 'click') {
            e.preventDefault();
         	globalState.set('showSearchbar', !globalState.get('showSearchbar'))
            return false;
        } else {
            return true;
        }
    }
})

api.createWidget('mdmaintoolbar-search', _.extend({}, {
    tagName: 'form#md-searchbar.mdmaintoolbar.center',
    buildAttributes() {
        return {
            action: '/search',
            method: 'GET'
        }
    },
    html(attr, state) {
        if (!globalState.get('showSearchbar')) {
            return false
        }
        return [
            api.h('input#input-box.toolbar-title.center', {
                name: 'q',
                type: 'text',
                placeholder: '搜索 hitorino'
            }, [])
        ];
    },
    click(e) {
        if (!e) {
            return true;
        } else if (e.type === 'click' && $(e.target).is('#close, #close *')) {
            e.preventDefault();
            globalState.set('showSearchbar', false)
            return false;
        } else {
            return true;
        }
    }
}, MainToolbarTemplate))

function getCategoryNameBySlug(slug) {
    const site = Discourse.Site.current()
    try {
        return _.find(site.categories, function(c) {
            return (c.get('slug') && c.get('slug') === slug)
        }).get('name')
    } catch (e) {
        return '未命名'
    }
}

function getTitle() {    
    let path = getCurrentPath()
    if (isSpecialTopicList()) {
        if (path === '/') {
            path = '/latest'
        }
        return I18n.t(`filters${path.replace('/','.')}.title`)
    }
    const regexpCategory = /\/c\/([^\/]+)/
    const regexpCategoryTag = /tags\/c\/([^\/]+)\/([^\/]+)/
    const regexpTag = /tags\/([^\/]+)/
    let mo = path.match(regexpCategoryTag)
    if (mo) {
        return `${getCategoryNameBySlug(mo.group(1))} - ${mo.group(2)}`
    }
    mo = path.match(regexpCategory)
    if (mo) {
        return getCategoryNameBySlug(mo.group(1))
    }
    mo = path.match(regexpTag)
    if (mo) {
        return (mo.group(1))
    }
    return undefined
}

api.createWidget('mdmaintoolbar-topic-list', _.extend({}, {
    tagName: 'div#md-topic-list.mdmaintoolbar.md-title.left',
    
    html(attr, state) {
        return [
                api.h('span', getTitle())
        ];
    }
}, MainToolbarTemplate))


api.createWidget('mdmaintoolbar-topic', _.extend({}, {
    tagName: 'div#md-topic.mdmaintoolbar.left.md-title',
    
    html(attr, state) {
        const controller = this.register.lookup('controller:topic')
        const model = controller.get('model')
        const title = model.get('unicode_title') || model.get('title')
        const tags = model.tags;
        const isPrivateMessage = model.get('isPrivateMessage');
        const tagsHtml = tags.map((tag) => {
            return new RawHtml({
                html: renderTag(tag, { isPrivateMessage })
            })
        })
        return [
                api.h('span', title),
                tagsHtml
        ];
    }
}, MainToolbarTemplate))


function getUser() {
    var user = Discourse.User.current();
    const navbar_background_default = "https://forum.hitorino.moe/uploads/default/original/1X/6e3efd0a3b368ef708e1b70c550359f01f701f50.png";
    if (!user) {
        user = {
            get(key) {
                switch (key) {
                    case 'navbar_background':
                        return navbar_background_default;
                    case 'username':
                        return 'hitorino';
                    case 'name':
                        return '未登录';
                    case 'unread_notifications':
                    case 'unread_private_messages':
                        return 0;
                    default:
                        return '';
                }
            }
        }
    } else {
        user.set('navbar_background',
            (user.get('profile_background')
                ? user.get('profile_background')
                : navbar_background_default));
    }
    return user;
}

const mdIcon = (icon, isLight = false) => {
    //api.h('i.material-icons.md-24.md-'+(isLight?'light':'dark'), icon)
    return api.h(`i.material-icons.mdi.mdi-${icon.replace('_','-')}.md-24.md-${(isLight?'light':'dark')}`)
}

const mdEntry = (link, icon, text, count = 0, isExternalLink = false) => {
    var countSpan = undefined;
    if (count) {
        countSpan = api.h('span.count', `${count}`)
    }
    return api.h('a.md-entry.initial', {
        href: link,
        'data-auto-route': `${!isExternalLink}`
    }, [
        mdIcon(icon),
        api.h('span', text),
        countSpan
    ]);
};

window.onMDNavDrawerToggled = function(isOpen) {}

// Widgets

api.createWidget('mdtoolbar', {
    tagName: 'div#toolbar',
    buildKey: () => 'mdtoolbar',
    defaultState() {
        return {
            hide: false,
            path: globalState.currentPath
        }
    },
    html(attr, state) {
        this.appEvents.off('msktheme:page-change')
        this.appEvents.on('msktheme:page-change', ()=>{
            state.path = getCurrentPath()
            this.scheduleRerender()
        })
        let currentMainToolBar = globalState.get('currentToolbar') || getCurrentToolbar()
        if (currentMainToolBar) {
            currentMainToolBar = this.attach(`mdmaintoolbar-${currentMainToolBar}`)
        } else {
            currentMainToolBar = []
        }
        return [
            this.attach('md-menubutton', {
                openChild: false
            }),
            h('a#logo.toolbar-title.left', {
                'data-auto-route': 'true',
                href: '/'
            }, [
                h('img', {
                    id: 'md-site-logo',
                    src: window.HITORINO_SITE_LOGO || Discourse.SiteSettings.logo_url,
                    alt: 'hitorino*'
                })
            ]),
            currentMainToolBar,
            this.attach('mdmaintoolbar-search-button')
        ];
    },
    click(e) {
        if (e.type === 'click' && e.button === 0 && e.target.id ===
            'md-site-logo') {
            e.preventDefault();
            DiscourseURL.routeTo('/');
            return false;
        } else {
            return true;
        }
    },
    openSearchBar() {
        this.state.hide = true;
    },
    closeSearchBar() {
        $('form#search-bar').fadeOut(250, ()=> {
            this.state.hide = false;
            this.scheduleRerender();
        });
    }
});


{
    // toolbar -> md-menubutton | md-searchbutton
    const toolbarButtonPrototype = {
        tagName: '',
        buildKey(attrs) {
            return '';
        },
        defaultState(attrs) {
            if (attrs.hasOwnProperty('openChild')) {
                return {
                    openChild: attrs.openChild,
                    user: getUser()
                };
            } else {
                return {
                    openChild: false,
                    user: getUser()
                };
            }
        },
        makeIcon(name) {
            //return api.h(`i.material-icons.md-24.md-light`, name);
            return mdIcon(name, true);
        },

        makeContent() {},

        html(attr, state) {
                return this.makeContent.call(this, attr, state);
        },

        onChildOpen() {},
        onChildClose() {},

        click(e) {
            if (!e) {
                return true;
            }
            e.preventDefault();
            this.state.openChild = !this.state.openChild;
            if (this.state.openChild) {
                this.onChildOpen.call(this, this.attr, this.state);
            } else {
                this.onChildClose.call(this, this.attr, this.state);
            }
            return false;
        }
    };

    api.createWidget('md-menubutton', $.extend({}, toolbarButtonPrototype, {
        tagName: 'a#mdmenu-button.md-button.left.initial',
        buildKey(attrs) {
            return 'md-menubutton';
        },
        
        makeContent(attrs, state) {
            var contents = [this.makeIcon('menu')];
            const unreadNotifications = state.user.get('unread_notifications');
            this.appEvents.on('notifications:changed', ()=>{
                this.state.user = getUser();
                this.scheduleRerender();
            });
            if (!!unreadNotifications) {
                contents.push(this.attach('link', {
                    action: 'click',
                    className: 'badge-notification unread-notifications',
                    rawLabel: unreadNotifications,
                    omitSpan: true,
                    title: "notifications.tooltip.regular",
                    titleOptions: {
                        count: unreadNotifications
                    }
                }));
            }

            contents.push(this.attach('mdnavbar', {
                open: state.openChild
            }));
            return contents;
        },
        onChildOpen() {
            const centerLeft = $('#toolbar .center').css('left');
            const w1 = $('html').width();
            $('html').css('overflow-y','hidden');
            const w2 = $('html').width();
            $('html').css('margin-right', w2-w1);
            $('#toolbar .right').css('right', 8+w2-w1);
            $('#toolbar .center').css('left', centerLeft);
            $('body').addClass('md-no-selection');
        },
        onChildClose() {
            $('html').css('overflow-y','');
            $('html').css('margin-right', '');
            $('#toolbar .right').css('right', '');
            $('#toolbar .center').css('left', '');
            $('body').removeClass('md-no-selection');
        }
    }));

    api.createWidget('md-searchbutton', $.extend({}, toolbarButtonPrototype, {
        tagName: 'div#search.md-button.right.initial',
        buildKey: () => 'md-searchbutton',
        makeContent(attrs, state) {
            var contents = [this.makeIcon('magnify')];
            return contents;
        },
        onChildOpen(attr, state) {
            this.sendWidgetAction('openSearchBar');
        }
    }));
}

api.createWidget('mdsearchbar', {
    tagName: 'form#search-bar',
    buildAttributes() {
        return {
            action: '/search',
            method: 'GET'
        }
    },
    html(attr, state) {
        if (attr.hide) {
            return []
        }
        return [
            api.h('input#input-box.toolbar-title.center', {
                name: 'q',
                type: 'text',
                placeholder: '搜索 hitorino'
            }, []),
            api.h('div#clear.md-button.left.initial', api.h(
                'i#clear-icon.material-icons.md-24.md-light', {
                    style: 'transform: rotateY(180deg)'
                }, 'backspace')),
            api.h('div#close.md-button.right.initial', api.h(
                'i#close-icon.material-icons.md-24.md-light', {
                    style: 'transform: rotateY(180deg)'
                }, 'clear'))
        ];
    },
    click(e) {
        if (!e) {
            return true;
        } else if (e.type === 'click') {
            e.preventDefault();
            switch (e.target.id) {
                case 'clear-icon':
                    $('#toolbar #input-box').val('');
                    break;
                case 'close-icon':
                    this.sendWidgetAction('closeSearchBar');
                    break;
            }
            return false;
        } else {
            return true;
        }
    }
});

// mdmenu/mdnavbar here
api.createWidget('mdnavbar', {
    tagName: 'div#mdnavbar',
    userInfo() {
        const user = this.user;
        const userAvatar = api.h('a#user-avatar', {
            href: `/u/${user.get('username')}`,
            'data-auto-route': 'true'
        }, [
            api.h('img', {
                src: user.get('avatar_template').replace(
                    "{size}", "96")
            })
        ]);
        const userNames = api.h('a#user-names', {
            href: `/u/${user.get('username')}`,
            'data-auto-route': 'true'
        }, [
            user.get('username'),
            api.h('br'),
            user.get('name')
        ]);
        return api.h('div#user-info', {
            style: `background-image: url(${user.get('navbar_background')})`
        }, [
            userAvatar,
            userNames,
            api.h('span#user-title', user.get('title'))
        ])
    },

    account() {
        if (!Discourse.User.current()) {
            return api.h('div#account', [
                api.h('span.subheader', '账户'),
                mdEntry('/login', 'account', '登录账户')
            ])
        }
        const user = this.user;
        let insider = undefined;
        if (!!user.groups && user.groups.filter(function(g) {
                return g.name === "hitorino-insider";
            }).length == 0) {
            insider = mdEntry('https://insider.hitorino.moe/', 'account-multiple-plus', 'insider 申请', 0, false);
        }

        let admin = undefined;
        if (!!user.admin) {
            admin = mdEntry('/admin', 'key', '后台管理');
        }
        return api.h('div#account', [
            api.h('span.subheader', '账户'),
            admin,
            mdEntry(`/u/${user.get('username')}/preferences`,
                'settings', '偏好设置'),
            api.h('a#logout.md-entry.initial', [
                mdIcon('power'),
                api.h('span', '登出账户')
            ]),
            insider
        ]);
    },

    misc() {
        const user = this.user;
        return api.h('div#misc', [
            api.h('span.subheader', '更多'),
            mdEntry('https://hitorino.moe/', 'home',
                'hitorino × 猫娘领域 首页', 0, false),
            mdEntry('https://m.hitorino.moe/', 'account-multiple',
                'hitorino × Mastodon 实例', 0, false),
            mdEntry('/faq', 'information', 'hitorino 社区介绍'),
            mdEntry('/tos', 'book', 'hitorino 服务条款'),
            this.attach('mdnavbar-switchview')
        ]);
    },

    navDrawer(hide) {
        if (!Discourse.User.current()) {
            return api.h(`div#nav-drawer${hide?'.hide-nav-drawer':''}`, [
                this.userInfo(),
                this.account(),
                this.misc()
            ])
        }
        return api.h(`div#nav-drawer${hide?'.hide-nav-drawer':''}`, [
            this.userInfo(),
            this.attach('mdmenu-tabs'),
            this.attach('mdnavbar-categories'),
            this.account(),
            this.misc()
        ])
    },
    html(attrs) {
        this.user = getUser();
        window.onMDNavDrawerToggled || window.onMDNavDrawerToggled(attrs.open);
        if (!attrs.open) {
            return [
                this.navDrawer(true),
                api.h('div#overlay.hide-nav-drawer')
            ];
        }
        $('#overlay').show();
        $('#nav-drawer').show();
        return [
            api.h('div#overlay'),
            this.navDrawer()
        ]
    },
    click(e) {
        if (!aClickHandler(e)) {
            return false;
        } else if (e.target.id === 'overlay') {
            e.preventDefault();
            $('#overlay').fadeOut(500);
            $('#nav-drawer').addClass('closed').fadeOut(500, function() {
                $('#mdmenu-button').trigger('click');
            });
            return false
        } else if (e.target.id === 'logout') {
            e.preventDefault();
            //api.container.lookup("controller:application").send("logout");
            logout();
            return false
        } else {
            return false;
        }
    }
});

{
    // Tabs
    // # toolbar -> mdmenu/navbar
    // Notifcation - PrivMsg - Bookmark

    const BOOKMARK_TYPE = 3;
    const PRIVATE_MESSAGE_TYPE = 6;

    const GLOBAL_ENTRY_LIMIT = 3;
    const NETWORK_ENTRY_LIMIT = GLOBAL_ENTRY_LIMIT + 1;
    const TAB_NAMES = {
        notifications: '通知',
        privmsgs: '私信',
        bookmarks: '书签'
    };
    const tab_header_tagNames = {
        notifications: 'a#md-tab-header-notifications.subheader.tab-header',
        privmsgs: 'a#md-tab-header-privmsgs.subheader.tab-header',
        bookmarks: 'a#md-tab-header-bookmarks.subheader.tab-header'
    };

    function truncateToLimit(content, limit) {
        if (content && (content.length > limit)) {
            return content.slice(0, limit);
        } else {
            return content;
        }
    }

    api.createWidget('mdmenu-tab-content', {
        tagName: 'div.tab-content.initial',
        buildClasses: (attrs) => `tab-content-${attrs.type} ${attrs.type}`,
        buildKey: (attrs) => `tab-content-${attrs.type}`,
        buildAttributes: (attrs) => attrs.hide ? {style: 'display: none;'} : {},

        defaultState() {
            return {
                entries: [],
                loading: false,
                loaded: false
            };
        },
        
        notificationsChanged() {
            this.refreshNotifications(this.state);
        },

        clearLoadingFlags() {
            this.state.loading = false;
            this.state.loaded = true;
            this.scheduleRerender();
        },

        doFilter(iterable) {
            if (iterable && this.attrs.type === 'privmsgs') {
                return iterable.filter((x) => x.notification_type === PRIVATE_MESSAGE_TYPE);
            } else {
                return iterable;
            }
        },

        loadBookmarks(state) {
            const user = getUser();
            const ajax = require('discourse/lib/ajax').ajax;
            ajax(
                `/user_actions.json?username=${user.get('username')}&filter=${BOOKMARK_TYPE}&offset=0`
            ).then(result => {
                state.entries = truncateToLimit(result.user_actions, NETWORK_ENTRY_LIMIT);
            }).catch((err) => {
                state.entries = [];
            }).finally(() => {
                this.clearLoadingFlags()
            });
            state.loading = true;
        },

        loadNotifications(state) {
            const type = this.attrs.type;
            const stale = this.store.findStale('notification', {
                offset: 0
            }, {
                cacheKey: 'recent-${type}'
            });

            if (stale.hasResults) {
                let content = this.doFilter(stale.results.get('content'));

                // we have to truncate to limit, otherwise we will render too much
                state.entries = truncateToLimit(content, NETWORK_ENTRY_LIMIT);
            } else {
                state.loading = true;
            }

            stale.refresh().then(notifications => {
                if (type === 'notifications') {
                    const unread = notifications.get('content').filter((x)=>!x.read).length;
                    this.currentUser.set('unread_notifications', unread);
                } else if (type === 'privmsgs') {
                    const unread = this.doFilter(notifications.get('content')).filter((x)=>!x.read).length;
                    this.currentUser.set('unread_private_messages', unread);
                }
                state.entries = truncateToLimit(this.doFilter(notifications.get('content')), NETWORK_ENTRY_LIMIT);
            }).catch((err) => {
                state.entries = [];
            }).finally(() => {
                this.clearLoadingFlags();
            });
        },

        refreshNotifications(state) {
            const type = this.attrs.type;

            if (this.loading) {
                return;
            }

            if (type === 'bookmarks') {
                this.loadBookmarks(state);
            } else {
                this.loadNotifications(state);
            }
        },

        html(attr, state) {
            if (attr.hide) {
                return [];
            }
            const type = attr.type;
            const user = getUser();
            if (!state.loaded) {
                this.refreshNotifications(state);
            }

            const result = [];

            if (state.loading) {
                result.push(h('div.spinner-container', api.h('div.spinner')));
            } else if (state.entries.length === 0 || state.entries.length) {
                const notificationItems = truncateToLimit(state.entries, GLOBAL_ENTRY_LIMIT).map(n => {
                    if (type === 'bookmarks') {
                        return this.attach('mdmenu-bookmark-item', n);
                    } else {
                        return this.attach('mdmenu-notification-item', n);
                    }
                });
                result.push(notificationItems);
                
                const linkTarget = {
                    notifications: `/u/${user.get('username')}/notifications`,
                    privmsgs: `/u/${user.get('username')}/messages`,
                    bookmarks: `/u/${user.get('username')}/activity/bookmarks`
                }
                if (state.entries.length <= GLOBAL_ENTRY_LIMIT) {
                    if (false) { //comment
                        result.push(api.h(`a.md-entry.initial.no-more.${type}`, [
                            mdIcon('check'),
                            `没有更多${TAB_NAMES[type]}`
                        ]));
                    }
                    result.push(mdEntry(linkTarget[type], 'check', `没有更多${TAB_NAMES[type]}`));
                } else {
                    result.push(mdEntry(linkTarget[type], 'dots-horizontal', `查看全部${TAB_NAMES[type]}`));
                }
            }

            return result;
        }
    });

    api.createWidget('mdmenu-tabs', {
        tagName: 'div.tabs',
        buildKey: () => 'mdmenu-tabs',
        defaultState() {
            return {
                active: 'notifications',
                'initial-notifications': true,
                'initial-privmsgs': true,
                'initial-bookmarks':true
            };
        },
        html(attr, state) {
            function getUnread(x) {
                const user = getUser();
                if (user.get(x)) {
                    return `（${user.get(x)}）`;
                } else {
                    return '';
                }
            }

            const tab_header_labels = {
                notifications: `${TAB_NAMES['notifications']}${getUnread('unread_notifications')}`,
                privmsgs: `${TAB_NAMES['privmsgs']}${getUnread('unread_private_messages')}`,
                bookmarks: TAB_NAMES['bookmarks']
            }
            let tab_headers = api.h('div.md-tab-headers', [
                'notifications', 'privmsgs', 'bookmarks'
            ].map(function(x) {
                const initial = state[`initial-${x}`]?'.initial':'';
                const active = (state.active === x)?'.active':'';
                return api.h(tab_header_tagNames[x] +
                        active+initial, tab_header_labels[x]
                );
            }));
            return [
                tab_headers,
                ['notifications', 'privmsgs', 'bookmarks'].map((type) => {
                    return this.attach('mdmenu-tab-content', {
                        type: type,
                        hide: type!==state.active
                    })
                })
            ]
        },

        click(e) {
            if (e && e.target.id.startsWith('md-tab-header-')) {
                this.state.active = e.target.id.replace('md-tab-header-', '');
                this.state[`initial-${this.state.active}`] = false;
                return false;
            } else {
                return true;
            }
        }
    });
}

{
    // toolbar -> mdmenu/navbar -> tabs -> bookmarks
    api.createWidget('mdmenu-bookmark-item', {
        tagName: 'a.md-entry.initial',
        buildAttributes(attr) {
            const url = `/t/topic/${attr.topic_id}/${attr.post_number}`
            return {
                href: url,
                'data-auto-route': 'true'
            }
        },
        html(attr) {
            return [mdIcon('bookmark'), attr.title];
        },
        click: aClickHandler
    });
}

{
    // toolbar -> mdmenu/navbar -> tabs -> notifications|privmsgs
    const LIKED_TYPE = 5;
    const INVITED_TYPE = 8;
    const GROUP_SUMMARY_TYPE = 16;

    api.createWidget('mdmenu-notification-item', {
        tagName: 'a.md-entry.initial',

        buildClasses(attrs) {
            const classNames = [];
            if (attrs.get('read')) {
                classNames.push('read');
            }
            if (attrs.is_warning) {
                classNames.push('is-warning');
            }
            return classNames;
        },
        url() {
            const attrs = this.attrs;
            const data = attrs.data;
            const badgeId = data.badge_id;
            if (badgeId) {
                let badgeSlug = data.badge_slug;

                if (!badgeSlug) {
                    const badgeName = data.badge_name;
                    badgeSlug = badgeName.replace(/[^A-Za-z0-9_]+/g,
                        '-').toLowerCase();
                }

                let username = data.username;
                username = username ? "?username=" + username.toLowerCase() :
                    "";
                return Discourse.getURL('/badges/' + badgeId + '/' +
                    badgeSlug + username);
            }

            const topicId = attrs.topic_id;

            if (topicId) {
                return postUrl(attrs.slug, topicId, attrs.post_number);
            }

            if (attrs.notification_type === INVITED_TYPE) {
                return userPath(data.display_username);
            }

            if (data.group_id) {
                return userPath(data.username + '/messages/group/' +
                    data.group_name);
            }
        },

        description() {
            const data = this.attrs.data;
            const badgeName = data.badge_name;
            if (badgeName) {
                return escapeExpression(badgeName);
            }

            if (this.attrs.fancy_title) {
                return this.attrs.fancy_title;
            }

            const title = data.topic_title;
            return Ember.isEmpty(title) ? "" : escapeExpression(title);
        },

        text(notificationType, notName) {
            const {
                attrs
            } = this;
            const data = attrs.data;
            const scope = (notName === 'custom') ? data.message :
                `notifications.${notName}`;

            if (notificationType === GROUP_SUMMARY_TYPE) {
                const count = data.inbox_count;
                const group_name = data.group_name;
                return I18n.t(scope, {
                    count,
                    group_name
                });
            }

            const username = formatUsername(data.display_username);
            const description = this.description();
            if (notificationType === LIKED_TYPE && data.count > 1) {
                const count = data.count - 2;
                const username2 = formatUsername(data.username2);
                if (count === 0) {
                    return I18n.t('notifications.liked_2', {
                        description,
                        username,
                        username2
                    });
                } else {
                    return I18n.t('notifications.liked_many', {
                        description,
                        username,
                        username2,
                        count
                    });
                }
            }
            return I18n.t(scope, {
                description,
                username
            });
        },

        info(attrs) {
            const notificationType = attrs.notification_type;
            const lookup = this.site.get('notificationLookup');
            const notName = lookup[notificationType];
            let {
                data
            } = attrs;
            let infoKey = notName === 'custom' ? data.message : notName;
            let text = emojiUnescape(this.text(notificationType,
                notName));
            let title = I18n.t(`notifications.alt.${infoKey}`);
            return {
                infoKey,
                notName,
                text,
                title
            }
        },

        buildAttributes(attrs) {
            const info = this.info(attrs);
            const href = this.url();
            return href ? {
                href: href,
                title: info.title,
                'data-auto-route': 'true'
            } : {};
        },
        html(attrs) {
            const info = this.info(attrs);
            // TODO: find replacements for 'at' and 'hand-pointing-right'
            const REPLACEMENTS = {
                'mentioned': "at",
                'group_mentioned': "at",
                'quoted': "format-quote-close",
                'replied': "reply",
                'posted': "reply",
                'edited': "pencil",
                'liked': "heart",
                'liked_2': "heart",
                'liked_many': "heart",
                'private_message': "email",
                'invited_to_private_message': "email",
                'invited_to_topic': "hand-pointing-right",
                'invitee_accepted': "account",
                'moved_post': "logout",
                'linked': "link",
                'granted_badge': "certificate",
                'topic_reminder': "hand-pointing-right",
                'watching_first_post': "radiobox-marked",
                'group_message_summary': "account-multiple"
            };
            const r = function(dname) {
                if (REPLACEMENTS[dname]) {
                    return REPLACEMENTS[dname];
                } else {
                    return dname;
                }
            }
            //const icon = api.h('i.material-icons.md-24.md-dark', {
            //    title: info.title
            //}, r(info.infoKey));
            const icon = mdIcon(r(info.infoKey))
            // We can use a `<p>` tag here once other languages have fixed their HTML
            // translations.
            let html = new RawHtml({
                html: `<span>${info.text}</span>`
            });

            return [icon, html];
        },
        
        click(e) {
            const id = this.attrs.id;
            const ajax = require('discourse/lib/ajax').ajax;
            ajax('/notifications/mark-read', { method: 'PUT', data: { id: id } }).then(()=>{
                this.sendWidgetAction('notificationsChanged');
            });
            this.attrs.set('read', true);
            setTransientHeader("Discourse-Clear-Notifications", id);
            if (document && document.cookie) {
                document.cookie =
                    `cn=${id}; expires=Fri, 31 Dec 9999 23:59:59 GMT`;
            }
            
            
            if (wantsNewWindow(e)) {
                return;
            }
            e.preventDefault();
            this.sendWidgetEvent('linkClicked');
            DiscourseURL.routeTo(this.url());
        }
    });
}


{
    api.createWidget('mdnavbar-switchview', {
        tagName: 'a#switch-view.md-entry.initial',
        html() {
            const site = Discourse.Site.current();
            var sv = {};
            if (site.mobileView == true) {
                sv = {
                    mode: 0,
                    icon: "laptop",
                    title: "桌面设备页面"
                };
            } else {
                sv = {
                    mode: 1,
                    icon: "cellphone",
                    title: "移动设备页面"
                };
            }
            return [
                mdIcon(sv.icon),
                api.h('span', sv.title)
            ];
        },
        click(e) {
            const Mobile = require('discourse/lib/mobile').default;
            e.stopPropagation();
            e.preventDefault();
            Mobile.toggleMobileView();
            return false
        }
    });
}

api.createWidget('mdnavbar-categories', {
    tagName: 'div#categories',
    categories() {
        const site = Discourse.Site.current();
        let result = [];
        // add category entries
		for (var i = 0; i < site.categories.length - 1; i++) {
		    result.push(api.h('a.md-entry.initial', {
		        href: site.categories[i].get('url'),
		        'data-auto-route': 'true'
		    }, [
		        api.h('div.list-icon', {style: `background-color: #${site.categories[i].get('color')}`}),
		        api.h('span', site.categories[i].get('name'))
            ]));
		}
		return result;
    },
    html() {
        return [
            api.h('span.subheader', '分区'),
            this.categories()
        ];
    },
    click: aClickHandler
});

api.reopenWidget('header', {
    html() {
        return this.attach('mdtoolbar');
    }
});
